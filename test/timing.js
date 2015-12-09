

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
var random3 = random1.concat(random2)


var blobs = Blobs(dirname)

tape('live stream triggers same tick (just before callback)', function (t) {
  
  var live = false

  pull(
    blobs.ls({live: true}),
    pull.drain(function (data) {
      console.log('stream1', data)
      if(data.sync) return next()
      if(live) throw new Error('live stream called twice!')
      live = true
      console.log(data)
      return false
    })
  )

  function next () {
    pull(
      pull.values(random1),
      blobs.add(function (err, _hash) {
        if(err) throw err
        t.ok(live)
        t.end()      
      })
    )
  }
})

tape('live stream triggers same tick (just before callback)', function (t) {
  //return t.end()  
  var live = false, sync = false
  pull(
    blobs.ls({live: true, long: true}),
    pull.drain(function (data) {
      if(data.sync) return next(sync = true)
      if(!sync) return

      console.log('stream2', data)
      if(live) throw new Error('live stream 2 called twice!')
      live = true
    })
  )

  function next () {
    pull(
      pull.values(random2),
      blobs.add(function (err, _hash) {
        console.log('ADDED random2')
        if(err) throw err
        t.ok(live)
        t.end()      
      })
    )
  }
})

