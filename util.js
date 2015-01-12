var Blake2s = require('blake2s')
var path    = require('path')
var pull    = require('pull-stream')

var isBuffer = Buffer.isBuffer

exports.toPath = function (dir, hash) {
  var i = hash.indexOf('.')
  var alg = hash.substring(i+1)

  var h = new Buffer(hash.substring(0, i), 'base64').toString('hex')
  return path.join(dir, alg, h.substring(0,2), h.substring(2))
}

exports.createHash = function (onHash) {
  var hash = new Blake2s()

  var hasher = pull.through(function (data) {
    data = isBuffer(data) ? data : new Buffer(data)
    hasher.size += data.length
    hash.update(data)
  }, function () {
    var digest = hash.digest('base64') + '.blake2s'
    hasher.digest = digest
    onHash && onHash(digest)
  })

  hasher.size = 0

  return hasher
}

function isString (s) {
  return 'string' === typeof s
}

exports.isHash = function (data) {
  return isString(data) && /^[A-Za-z0-9\/+]{43}=\.blake2s$/.test(data)
}
