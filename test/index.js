
var tape = require('tape')

var util = require('../util')
var Blobs = require('../')

var pull   = require('pull-stream')
var crypto = require('crypto')
var rimraf = require('rimraf')
var fs     = require('fs')
var path   = require('path')
var osenv  = require('osenv')
var Read   = require('pull-file')

var dirname = path.join(osenv.tmpdir(), 'test-multiblob')
rimraf.sync(dirname)

var l = 100, random1 = []
while(l --) random1.push(crypto.randomBytes(1024))

var l = 100, random2 = []
while(l --) random2.push(crypto.randomBytes(1024))

module.exports = function (alg) {

  var start = Date.now()

  function hasher (ary) {
    var hasher = util.createHash(alg, true)
    pull(pull.values(ary), hasher, pull.drain())
    return util.encode(hasher.digest, alg)
  }

  var hash1 = hasher(random1)
  var hash2 = hasher(random2)

  var blobs = Blobs({dir: dirname, hash: alg})

  tape('add, get, has, ls', function (t) {

    pull(
      pull.values(random1),
      blobs.add(function (err, hash) {
        if(err) throw err
        t.equal(hash, hash1)
        blobs.has(hash, function (err, has) {
          if(err) throw err
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
    blobs.has([hash1, hash2], function (err, ary) {
      if(err) throw err
      t.deepEqual(ary, [true, false])
      t.end()
    })
  })

  tape('meta returns {id, size, ts}', function (t) {
    blobs.meta(hash1, function (err, meta) {
      if(err) throw err
      t.ok(meta)
      t.equal(meta.id, hash1)
      t.equal(meta.size, 100*1024)
      t.ok(meta.ts > start)
      t.ok(meta.ts < Date.now())

      t.end()
    })
  })


  tape('ls streams the list of hashes', function (t) {

    pull(pull.values(random2), blobs.add(function (err) {
      if(err) throw err

      pull(
        blobs.ls(),
        pull.collect(function (err, ary) {
          if(err) throw err
          t.deepEqual(ary.sort(), [hash1, hash2].sort())


          pull(
            blobs.ls({long: true}),
            pull.collect(function (err, ary) {
              t.notOk(err)
              t.equal(ary.length, 2)
              console.log(ary)
              t.deepEqual(ary.map(function (e) {
                t.ok(e.ts < Date.now())
                t.equal(e.size, 102400)
                return e.id
              }).sort(), [hash1, hash2].sort())
              t.end()
            })
          )

        })
      )

    }))

  })

  //sometimes there are apis that need direct access
  //i.e. in electron.
  tape('resolve - direct access to the same file', function (t) {
    var filename = blobs.resolve(hash1)
    var hasher = util.createHash(alg, true)
    pull(
      Read(filename),
      hasher,
      pull.drain(null, function (err) {
        t.notOk(err)
        t.equal(util.encode(hasher.digest, alg), hash1)
        t.end()
      })
    )
  })

  tape('error if a a request is not a valid hash', function (t) {
    blobs.has('NOT A HASH', function (err) {
      console.log(err)
      t.ok(err)
      t.end()
    })

  })

  tape('hash of empty string', function (t) {
    var hasher = util.createHash(alg, true)
    hasher(function (_, cb) { cb(true) })(null, function () {})
    var empty = util.encode(hasher.digest, alg)
    console.log(empty)
    t.ok(blobs.isEmptyHash(empty))
    blobs.has(empty, function (err, has) {
      if(err) throw err
      t.ok(has)
      blobs.size(empty, function (err, zero) {
        if(err) throw err
        t.equal(zero, 0)
        pull(blobs.get(empty), pull.collect(function (err, ary) {
          t.deepEqual(Buffer.concat(ary), new Buffer(0))
          t.end()
        }))
      })
    })
  })

}

if(!module.parent)
  module.exports('blake2s')







