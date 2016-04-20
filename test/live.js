
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

function random(l) {
  var ary = []
  while(l --) ary.push(crypto.randomBytes(1024))
  return ary
}

var random1 = random(100)
var random2 = random(200)
var random3 = random(300)

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

  function toId(e) {
    if(e.sync) return e
    return e.id
  }

  tape('live stream', function (t) {

    var start = Date.now()

    var n = 3
    var live3=[], live3new=[], live2new=[], live1new=[]
    var old1live2=[], old2live1=[]

    var live3_long=[], live3new_long=[], live2new_long=[], live1new_long=[]
    var old1live2_long=[], old2live1_long=[]

    var sizes = {}

    watch(blobs.ls({live: true}), live3)
    watch(blobs.ls({old: false}), live3new)

    watch(blobs.ls({live: true, long: true}), live3_long)
    watch(blobs.ls({old: false, long: true}), live3new_long)

    add(random1, function (err, hash1) {
      if(err) throw err
      sizes[hash1] = 100*1024

      watch(blobs.ls({live: true}), old1live2)
      watch(blobs.ls({old: false}), live2new)
      watch(blobs.ls({live: true, long: true}), old1live2_long)
      watch(blobs.ls({old: false, long: true}), live2new_long)

      add(random2, function (err, hash2) {
        if(err) throw err
        sizes[hash2] = 200*1024

        watch(blobs.ls({live: true}), old2live1)
        watch(blobs.ls({old: false}), live1new)
        watch(blobs.ls({live: true, long: true}), old2live1_long)
        watch(blobs.ls({old: false, long: true}), live1new_long)

        add(random3, function (err, hash3) {
          if(err) throw err
          sizes[hash3] = 300*1024

          pull(blobs.ls({live: true}), pull.take(4), pull.collect(function (err, old3live0) {

            console.log('live3', [hash1, hash2, hash3])
            t.deepEqual(live3,   [{sync: true}, hash1, hash2, hash3])

            t.deepEqual(old1live2,   [hash1, {sync: true}, hash2, hash3])
            t.deepEqual(old2live1,   sort([hash1, hash2]).concat([{sync: true}, hash3]))
            t.deepEqual(old3live0,   sort([hash1, hash2, hash3]).concat([{sync: true}]))

            t.deepEqual(live3new,   [hash1, hash2, hash3])
            t.deepEqual(live2new,   [hash2, hash3])

            t.deepEqual(old1live2_long.map(toId),
              [hash1, {sync: true}, hash2, hash3])
            t.deepEqual(old2live1_long.map(toId),
              sort([hash1, hash2]).concat([{sync: true}, hash3]))
//            t.deepEqual(old3live0_long.map(toId),
//              sort([hash1, hash2, hash3]).concat([{sync: true}]))

            t.deepEqual(live3new_long.map(toId),   [hash1, hash2, hash3])
            t.deepEqual(live2new_long.map(toId),   [hash2, hash3])

            function checkMeta (e) {
              if(e.sync) return
              t.equal(e.size, sizes[e.id], 'correct size')
              t.ok(e.ts > start, 'newer than start')
              t.ok(e.ts < Date.now(), 'older than now')
            }

            ;[
              live3_long, live3new_long, live2new_long,
              live1new_long, old1live2_long, old2live1_long
            ].forEach(function (ary) {
              ary.forEach(checkMeta)
            })

            return t.end()
          }))
        })
      })
    })
  })
}

if(!module.parent) module.exports('blake2s')










