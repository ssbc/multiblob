# multiblob

A content-addressable-store that supports multiple hashing algorithms,
and pull-streams.

## example

``` js

var Blobs = require('multiblob')

var blobs = Blobs(dir) //pass in the basedir.

blobs.add

```

## api: Blobs(dir)

### add (hash?, cb?) => Sink

create a sink stream for writing a blob.
If `hash` was given, then it will error if the file turned out to be different.
If a `cb` is not given and there was an error, this function will throw.

### get (hash) => Source

create a source stream that reads from a given blob.
If the file does not exist this stream will error.

### has(hash, cb)

check if the given hash is in the store.

### ls() => Source

source stream that reads the list of hashes available in the store.

## todo

maybe emit events when blobs are stored?

## License

MIT
