
var tape = require('tape')

var util = require('../util')
var Blobs = require('../')

var pull   = require('pull-stream')
var crypto = require('crypto')
var rimraf = require('rimraf')
var path = require('path')
var osenv = require('osenv')

var dirname = path.join(osenv.tmpdir(), 'test-multiblob')
rimraf.sync(dirname)

var l = 100, random1 = []
while(l --) random1.push(crypto.randomBytes(1024))

var random2 = random1.slice().reverse()

var random3 = random1.slice().sort(function (a, b) {
  return a.readDoubleBE(0) - b.readDoubleBE(0)
})

module.exports = function (alg) {

  function hasher (ary) {
    var hasher = util.createHash(alg, true)
    pull(pull.values(ary), hasher, pull.drain())
    return util.encode(hasher.digest, alg)
  }

  var hash1 = hasher(random1)

  var blobs = Blobs(dirname)

  function watch(stream, ary) {
    if(!stream) throw new Error('stream must be provided')
    if(!ary) throw new Error('array must be provided')
    return pull(
      stream,
      pull.drain(function (data) {
        ary.push(data)
      }, function (err) {
        if(err) throw err
      })
    )
  }

  function add (file, cb) {
    pull(pull.values(file), blobs.add(cb))
  }

  function sort (ary) {
    return ary.sort(function (a, b) {
      var ha = new Buffer(a, 'base64').toString('hex')
      var hb = new Buffer(b, 'base64').toString('hex')
      return ha < hb ? -1 : ha == hb ? 0 : 1
    })
  }

  tape('live stream', function (t) {

    var n = 3
    var live3=[], live3new=[], old1live2=[],
      live2new=[], old2live1=[], live1new=[]

    watch(blobs.ls({live: true}), live3)
    watch(blobs.ls({old: false}), live3new)

    add(random1, function (err, hash1) {
      if(err) throw err
      watch(blobs.ls({live: true}), old1live2)
      watch(blobs.ls({old: false}), live2new)
      add(random2, function (err, hash2) {
        if(err) throw err

        watch(blobs.ls({live: true}), old2live1)
        watch(blobs.ls({old: false}), live1new)

        add(random3, function (err, hash3) {

          pull(blobs.ls({live: true}), pull.take(4), pull.collect(function (err, old3live0) {

            console.log('live3', [hash1, hash2, hash3])
            t.deepEqual(live3,   [{sync: true}, hash1, hash2, hash3])
            t.deepEqual(old1live2,   [hash1, {sync: true}, hash2, hash3])
            t.deepEqual(old2live1,   sort([hash1, hash2]).concat([{sync: true}, hash3]))
            t.deepEqual(old3live0,   sort([hash1, hash2, hash3]).concat([{sync: true}]))

            t.deepEqual(live3new,   [hash1, hash2, hash3])
            t.deepEqual(live2new,   [hash2, hash3])

            return t.end()
          }))
        })
      })
    })
  })
}

if(!module.parent) module.exports('blake2s')

