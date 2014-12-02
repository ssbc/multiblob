
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

var l = 100, random = []
while(l --)
  random.push(crypto.randomBytes(1024))


tape('add, get, has, ls', function (t) {

  var blobs = Blobs(dirname)

  var hasher = util.createHash()

  pull(
    pull.values(random),
    hasher,
    pull.drain(null, function (err) {
      if(err) throw err

      t.ok(hasher.digest)

      pull(
        pull.values(random),
        blobs.add(function (err, hash) {
          if(err) throw err
          t.equal(hash, hasher.digest)
          t.end()
        })
      )
    })
  )

})
