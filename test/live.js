
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

module.exports = function (alg) {

function hasher (ary) {
  var hasher = util.createHash(alg, true)
  pull(pull.values(ary), hasher, pull.drain())
  return util.encode(hasher.digest, alg)
}

var hash1 = hasher(random1)

var blobs = Blobs(dirname)

function watch(stream, ary) {
  return pull(
    stream,
    pull.drain(function (data) {
      ary.push(data)
    }, function (err) {
      if(err) throw err
    })
  )
}

tape('live stream', function (t) {

  var n = 3, ary1 = [], ary2 = []

  watch(blobs.ls({live: true}), ary1)

  pull(
    pull.values(random1),
    blobs.add(function (err, _hash) {
      if(err) throw err
      watch(blobs.ls({live: true}), ary2)

      pull(
        pull.values(random2),
        blobs.add(function (err, _hash) {
          if(err) throw err
          pull(
            blobs.ls({live: false}),
            pull.collect(function (err, ary3) {
              console.log(ary1, ary2, ary3)
              var sync = {sync: true}
              t.deepEqual(ary1[0], sync)
              t.deepEqual(ary2[1], sync)
              ary1.splice(0, 1)
              ary2.splice(1, 1)
              ary1.sort(); ary2.sort(); ary3.sort()
              t.deepEqual(ary1, ary3)
              t.deepEqual(ary2, ary3)
              t.end()
            })
          )
        })
      )
    })
  )
})

}

if(!module.parent) module.exports('blake2s')
