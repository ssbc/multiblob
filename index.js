var os      = require('os')
var cont    = require('cont')
var pull    = require('pull-stream')
var defer   = require('pull-defer')
var path    = require('path')
var toPull  = require('stream-to-pull-stream')
var explain = require('explain-error')
var mkdirp  = require('mkdirp')
var fs      = require('fs')
var glob    = require('pull-glob')

var util    = require('./util')
var createHash = util.createHash, toPath = util.toPath, isHash = util.isHash

function write (filename, cb) {
  return toPull.sink(fs.createWriteStream(filename), cb)
}

function read (filename) {
  return toPull.source(fs.createReadStream(filename))
}

function toArray (h) {
  return Array.isArray(h) ? h : [h]
}

var Blobs = module.exports = function (dir) {
  var n = 0
  var waiting = [], tmp = false
  var tmpdir = path.join(os.tmpdir(), 'blobs-'+dir.replace(/\//g, '-'))

  function mktmp (cb) {
    if(tmp) return cb()
    else waiting.push(cb)
  }

  mkdirp(tmpdir, function () {
    tmp = true; while(waiting.length) waiting.shift()()
  })

  function has (hash) {
    return function (cb) {
      fs.stat(toPath(dir, hash), function (err, stat) {
        cb(null, !!stat)
      })
    }
  }

  function size (hash) {
    return function (cb) {
      fs.stat(toPath(dir, hash), function (err, stat) {
        cb(null, stat ? stat.size : null)
      })
    }
  }

  function createTester (test) {
    return function (hashes, cb) {
      var n = !Array.isArray(hashes)
      cont.para(toArray(hashes).map(test)) (function (_, ary) {
        // This will only error if the hash is not present,
        // so never callback an error.
        // PS. if you have a situation where you never error
        // add a comment like this one to explain why.
        if(n) cb(null, ary[0])
        else  cb(null, ary)
      })
      return cb
    }
  }


  return {
    get: function (opts) {
      if(isHash(opts))
        return read(toPath(dir, opts))

      var hash = opts.key || opts.hash
      if(!isHash(hash))
        return pull.error(new Error(
          'multiblob.get: {hash} is mandatory'
        ))

      var stream = defer.source()
      fs.stat(toPath(dir, hash), function (err, stat) {
        if(opts.size != null && opts.size !== stat.size)
          stream.abort(new Error('incorrect file length,'
            + ' requested:' + opts.size + ' file was:' + stat.size
            + ' for file:' + hash
          ))

        else if(opts.max != null && opts.max < stat.size)
          stream.abort(new Error('incorrect file length,'
            + ' requested:' + opts.size + ' file was:' + stat.size
            + ' for file:' + hash
          ))

        else
          stream.resolve(read(toPath(dir, hash)))
      })

      return stream
    },

    size: createTester(size),

    has: createTester(has),

    add: function (hash, cb) {
      if(!cb) cb = hash, hash = null

      if(!cb) cb = function (err) {
        if(err) explain(err, 'no callback provided')
      }

      var deferred = defer.sink()

      mktmp(function () {
        var tmpfile = path.join(tmpdir, Date.now() + '-' + n++)
        var hasher = createHash()

        var ws = write(tmpfile, function (err) {
          if(err) return cb(explain(err, 'could not write to tmpfile'))

          if(hash && hash !== hasher.digest)
            return cb(new Error('actual hash:'+ hasher.digest
              + ' did not match expected hash:'+hash), hasher.digest)

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
    ls: function () {
      return pull(
        glob(path.join(dir, '*', '*', '*')),
        pull.map(function (filename) {

          var parts = filename.replace(dir+'/', '').split('/')
          var alg = parts.shift()
          return new Buffer(parts.join(''), 'hex').toString('base64')+'.'+alg
        })
      )
    },
    rm: function (hash, cb) {
      fs.unlink(toPath(dir, hash), cb)
    }
  }
}
