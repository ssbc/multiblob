var Blake2s = require('blake2s')
var createHash = require('crypto').createHash
var hash    = require('crypto')
var path    = require('path')
var pull    = require('pull-stream')

var isBuffer = Buffer.isBuffer

var algs = {
  blake2s: function () { return new Blake2s() },
  sha256: function () { return createHash('sha256') }
}

exports.encode = function (buf, alg) {
  if(!isBuffer(buf)) throw new Error('hash should be a buffer, was:'+buf)
  return buf.toString('base64')+'.'+alg
}

exports.decode = function (str) {
  var i = str.indexOf('.')
  var alg = str.substring(i+1)
  return {hash: new Buffer(str.substring(0, i), 'base64'), alg: alg}
}

exports.createHash = function (alg, noCompat) {
  alg = alg || 'blake2s'
  var hash = algs[alg]()

  var hasher = pull.through(function (data) {
    data = isBuffer(data) ? data : new Buffer(data)
    hasher.size += data.length
    hash.update(data)
  }, function () {
    return hasher.digest = noCompat === true ? hash.digest() : hash.digest('base64') + '.' + alg
//    hasher.digest = digest
  })

  hasher.size = 0
  return hasher
}

function isString (s) {
  return 'string' === typeof s
}

exports.isHash = function (data) {
  return isString(data) && /^[A-Za-z0-9\/+]{43}=\.(?:blake2s|sha256)$/.test(data)
}

exports.algs = algs
