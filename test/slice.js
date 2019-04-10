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

var l = 100
random1 = []
random2 = []

while (l--) {
  random1.push(crypto.randomBytes(1024))
  random2.push(crypto.randomBytes(1024))
}

module.exports = function (alg) {

var blobs = Blobs(dirname)

function hasher (ary) {
  var hasher = util.createHash(alg, true)
  pull(pull.values(ary), hasher, pull.drain())
  return util.encode(hasher.digest, alg)
}

var hash1 = hasher(random1)
var hash2 = hasher(random2)

tape('read a slice', function (t) {
  pull(
    pull.values(random1),
    blobs.add(function (err, hash) {
      t.error(err, 'add data')
      pull(
        blobs.getSlice({hash: hash, start: 10*1024, end: 80*1024}),
        pull.collect(function (err, bufs) {
          t.error(err, 'slice')
          var buf = Buffer.concat(bufs)
          t.deepEqual(buf, Buffer.concat(random1).slice(10*1024, 80*1024))
          t.end()
        })
      )
    })
  )
})

tape('error if requested hash is missing', function (t) {
  pull(
    pull(blobs.get(hash2)),
    pull.collect(function (err) {
      for (var key in err) {
        console.log(key, err[key])
      }

      t.ok(err, 'error message exists')
      t.equal(err.code, 'ENOENT', 'error code is unchanged')
      t.equal(err.message, 'could not get blob', 'error message is correctly delcared')
      t.end()
    })
  )
})

tape('error if requested size is incorrect', function (t) {
  pull(
    blobs.getSlice({hash: hash1, start: 10*1024, end: 80*1024, size: 7}),
    pull.collect(function (err) {
      t.ok(err)
      t.end()
    })
  )
})

tape('error if size is over max', function (t) {
  pull(
    blobs.getSlice({hash: hash1, start: 10*1024, end: 80*1024, max: 100*1024-1}),
    pull.collect(function (err) {
      t.ok(err)
      t.end()
    })
  )
})

}

if(!module.parent) module.exports('blake2s')
