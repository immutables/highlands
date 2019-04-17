'use strict'
const ops = require('./ops')

module.exports = {
  sha1: {},

  uri(jar, ext) {
    return `${jar.remote}${ext}`
  },

  set(jar, ext, sha1) {
    let uri = this.uri(jar, ext)
    this.sha1[uri] = sha1
  },

  get(jar, ext) {
    let uri = this.uri(jar, ext)
    return this.sha1[uri] || (this.sha1[uri] = this.fetch(jar, ext))
  },

  fetch(jar, ext, nofail) {
    let uri = this.uri(jar, ext)
    if (nofail) try {
      return extract(ops.fetch(uri))
    } catch (e) {
      ops.err(String(e))
      return undefined
    }
    return extract(ops.fetch(uri))

    function extract(input) {
      return input.split(' ')[0].trim()
    }
  }
}
