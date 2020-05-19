'use strict'
const ops = require('./ops')
const sums = require('./sums')
const mvn = require('./mvn')

const GEN_BANNER = 'Generated by up.js --uplock, do not edit, manual edits will be overridden'
const LOCKFILE = '.up.lock.json'

function exists() {
  return ops.exists(LOCKFILE)
}

function load() {
  if (!exists()) {
    throw `File '${LOCKFILE}' is not found, please restore it or regenerate by running with --uplock --lib`
  }
  let lockdata = JSON.parse(ops.read(LOCKFILE))
  let libs = lockdata.libs.map(l => [
    l.target,
    l.jars.map(toCoordsSavingChecksum(mvn.EXT.jar_sum, l.options)),
    (l.srcs.map(toCoordsSavingChecksum(mvn.EXT.src_sum, l.options)), l.options),
  ])
  return libs

  function toCoordsSavingChecksum(ext, options) {
    return j => {
      let jar = mvn.coords(j.coords, options)
      // this is not 'good' but it's the current design,
      // we side-effectly fill checksum cache
      sums.set(jar, ext, j.sha1)
      return jar
    }
  }
}

function store(libs) {
  let lockdata = {
    note: GEN_BANNER,
    libs: libs.filter(l => !l.options.internal)
        .map(l => ({
      target: String(l.target),
      options: l.options,
      jars: l.jars.map(outputJar),
      srcs: l.srcs.map(outputSrc),
    }))
  }
  return ops.write(LOCKFILE, JSON.stringify(lockdata, null, 2))

  function outputJar(j) {
    return {
      coords: String(j),
      sha1: j.checksumJar
    }
  }

  function outputSrc(j) {
    return {
      coords: String(j),
      sha1: j.checksumSrc,
    }
  }
}

module.exports = {
  exists, load, store
}
