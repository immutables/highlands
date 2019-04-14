'use strict'
const sums = require('./sums')

const REPO = 'https://repo1.maven.org/maven2/'
const EXT = {
  jar: '.jar',
  src: '-sources.jar',
  jar_sum: '.jar.sha1',
  src_sum: '-sources.jar.sha1',
}

class Coords {
  constructor(gavc) {
    this.gavc = gavc
  }

  get group() { return this.gavc[0] }
  get artifact() { return this.gavc[1] }
  get version() { return this.gavc[2] }
  get classifier() { return this.gavc[3] }

  toString() {
    let [g, a, v, c] = this.gavc
    return (c ? [g, a, c, v] : [g, a, v]).join(':')
  }

  get filename() {
    let [_, a, v, c] = this.gavc
    return [a, v, c].filter(Boolean).join('-')
  }

  get filenameJar() {
    return `${this.filename}${EXT.jar}`
  }

  get filenameSrc() {
    return `${this.filename}${EXT.src}`
  }

  get checksumJar() {
    return sums.get(this, EXT.jar_sum)
  }

  get checksumSrc() {
    return sums.get(this, EXT.src_sum)
  }

  fetchChecksumJar(nofail) {
    return sums.fetch(this, EXT.jar_sum, nofail)
  }

  fetchChecksumSrc(nofail) {
    return sums.fetch(this, EXT.src_sum, nofail)
  }

  get path() {
    let [g, a, v, _] = this.gavc
    return [g.replace(/\./g, '/'), a, v].join('/') + '/'
  }

  get remote() {
    return REPO + this.path + this.filename
  }

  get info() {
    return {
      coords: String(this),
      groupId: this.group,
      artifactId: this.artifact,
      version: this.version,
      classifier: this.classifier,
      jar: {
        uri: `${this.remote}${EXT.jar}`,
        sha1: this.fetchChecksumJar(/*nofail*/true) || '__UNAVAILABLE__',
      },
      sources: {
        uri: `${this.remote}${EXT.src}`,
        sha1: this.fetchChecksumSrc(/*nofail*/true) || '__UNAVAILABLE__',
      }
    }
  }
}

function coords(input) {
  if (input instanceof Coords) return input
  let data = String(input).split(':')
  if (data.length === 3) {
    let [g, a, v] = data
    return new Coords([g, a, v, undefined])
  }
  if (data.length === 4) {
    let [g, a, c, v] = data
    return new Coords([g, a, v, c])
  }
  throw `Cannot parse maven coords ${input}`
}

module.exports = {
  coords, EXT
}
