
var Blake2s = require('blake2s')
var cont    = require('cont')
var pull    = require('pull-stream')
var defer   = require('pull-defer')
var path    = require('path')
var toPull  = require('stream-to-pull-stream')
var explain = require('explain-error')
var mkdirp  = require('mkdirp')
var fs      = require('fs')
var glob    = require('pull-glob')

function toPath(dir, hash) {
  var i = hash.indexOf('.')
  var alg = hash.substring(i+1)

  var h = new Buffer(hash.substring(0, i), 'base64').toString('hex')
  return path.join(dir, alg, h.substring(0,2), h.substring(2))
}

function createHash (onHash) {
  var hash = new Blake2s()

  var hasher = pull.through(function (data) {
    hash.update(data)
  }, function () {
    var digest = hash.digest('base64') + '.blake2s'
    hasher.digest = digest
    onHash && onHash(digest)
  })

  return hasher
}

var Blobs = module.exports = function (dir) {
  var n = 0
  var waiting = [], tmp = false

  function mktmp (cb) {
    if(tmp) return cb()
    else waiting.push(cb)
  }

  mkdirp(path.join(dir, 'tmp'), function () {
    tmp = true; while(waiting.length) waiting.shift()()
  })

  function write (filename, cb) {
    return toPull.sink(fs.createWriteStream(filename), cb)
  }

  function read (filename) {
    return toPull.source(fs.createReadStream(filename))
  }

  return {
    get: function (hash) {
      return read(toPath(dir, hash))
    },

    has: function (hash, cb) {
      fs.stat(toPath(dir, hash), cb)
      return this
    },

    add: function (hash, cb) {
      if(!cb) cb = hash, hash = null

      if(!cb) cb = function (err) {
        if(err) explain(err, 'no callback provided')
      }

      var deferred = defer.sink()

      mktmp(function () {
        var tmpfile = path.join(dir, 'tmp', Date.now() + '-' + n++)
        var hasher = createHash()

        var ws = write(tmpfile, function (err) {
          if(err) return cb(explain(err, 'could not write to tmpfile'))

          if(hash && hash !== hasher.digest)
            return cb(new Error('actual hash:'+ hasher.digest
              + ' did not match expected hash:'+hash))

          var p = toPath(dir, hash || hasher.digest)

          mkdirp(path.dirname(p), function () {

            fs.rename(tmpfile, p, function (err) {
              if(err) cb(explain(err, 'could not move file'))
              else    cb(null, hasher.digest)
            })
          })
        })

        deferred.resolve(
          pull(hasher, ws)
        )
      })

      return deferred
    },
    list: function () {
      return pull(
        glob(path.join(dir, '*', '*', '*')),
        pull.map(function (filename) {

          var parts = filename.replace(dir+'/', '').split('/')
          var alg = parts.shift()
          return new Buffer(parts.join(''), 'hex').toString('base64')+'.'+alg
        })
      )
    }
  }

}

