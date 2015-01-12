# multiblob

A content-addressable-store that supports multiple hashing algorithms,
and pull-streams.

## example

``` js

var Blobs = require('multiblob')

var blobs = Blobs(dir) //pass in the basedir.

pull(source, blobs.add(function (err, hash) {
  console.log('added source to blobs:', hash)
})

```

## api: Blobs(dir)

### add (hash?, cb?) => Sink

create a sink stream for writing a blob.
If `hash` was given, then it will error if the file turned out to be different.
If a `cb` is not given and there was an error, this function will throw.

### get (hash || opts) => Source

create a source stream that reads from a given blob.
If the file does not exist this stream will error.

If the argument is a `hash` string, then return the stream.
If the argument is an `opts` object, with the `key: hash` property,
retrive that blob, but error if the size does not exactly match the
`size` property, or is over `max` property (in bytes)

### has(hash, cb)

check if the given hash is in the store.
If `hash` is an array of hashes,
`size` will callback with an array of booleans.

### size(hash, cb)

get the size of this blob. If `hash` is an array of hashes,
`size` will callback with an array of sizes.
If the hash does not exist in the store, `size` will callback `null`.


### ls() => Source

source stream that reads the list of hashes available in the store.

### rm(hash, cb)

remove a hash from the store.

## todo

maybe emit events when blobs are stored?

## License

MIT
