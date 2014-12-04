
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

var l = 100, random2 = []
while(l --) random2.push(crypto.randomBytes(1024))

function hasher (ary) {
  var hasher = util.createHash()
  pull(pull.values(ary), hasher, pull.drain())
  return hasher.digest
}

var hash1 = hasher(random1)
var hash2 = hasher(random2)

var blobs = Blobs(dirname)

tape('add, get, has, ls', function (t) {

  pull(
    pull.values(random1),
    blobs.add(function (err, hash) {
      if(err) throw err
      t.equal(hash, hash1)
      blobs.has(hash, function (_, has) {
        t.ok(has)
        t.end()
      })
    })
  )

})

tape('add accepts the correct hash', function (t) {

  pull(
    pull.values(random1),
    blobs.add(hash1, function (err, hash) {
      if(err) throw err
      t.equal(hash, hash1)
      t.end()
    })
  )

})

tape('add errors with incorrect hash', function (t) {

  pull(
    pull.values(random2),
    blobs.add(hash1, function (err, hash) {
      t.ok(err)
      t.equal(hash, hash2)
      //if the hash was wrong, do not add it.
      blobs.has(hash, function (_, has) {
        console.log(_, has)
        t.notOk(has)
        t.end()
      })
    })
  )

})

tape('has can take array', function (t) {
  blobs.has([hash1, hash2], function (_, ary) {
    t.deepEqual(ary, [true, false])
    t.end()
  })
})

tape('ls streams the list of hashes', function (t) {

  pull(pull.values(random2), blobs.add(function (err) {
    if(err) throw err

    pull(
      blobs.ls(),
      pull.collect(function (err, ary) {
        t.deepEqual(ary.sort(), [hash1, hash2].sort())
        t.end()
      })
    )

  }))

})
