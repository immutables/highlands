'use strict'
const mvn = require('./mvn')
const buck = require('./buck')
const libs = require('./libs')
const syms = require('./syms')
const mods = require('./mods')
const idea = require('./idea')
const solar = require('./solar')
const args = require('./args')
const ops = require('./ops')
const pub = require('./pub')
const grab = require('./grab')
const center = require('./center')

const opts = args({
  '--help': ['Prints usage and option hints', function() {
    this.usage()
  }, 1],
  '--trace': ['Enable tracing of command line calls and created files', () => {
    ops.use.trace = true
  }, 2],
  '--grab': ['Fetches predefined grab files returning downloaded file location', (target) => {
    target = buck.target(target)
    grab.genBuckfile(target.path)
    buck.fetch(target.pattern)
    syms.linkOutput(target.pattern)
    console.log(grab.get(target))
  }, 3],
  '--uplock': ['Use up.js library definitions to update lib lock', () => {
    libs.uplock()
  }, 5],
  '--lib': ['Generate library rules and jar symlinks', () => {
    libs.prepare()
    console.error(String(libs))
    libs.genBuckfiles()
    grab.genBuckfiles()
    buck.fetch()
    syms.linkOutput()
  }, 10],
  '--symout': ['Generate output symlinks', () => {
    libs.prepare()
    console.error(String(libs))
    buck.fetch()
    syms.linkOutput()
  }, 11],
  '--intellij': ['Generates project for Intellij IDEA', () => {
    libs.prepare()
    mods.discover()
    console.error(String(mods))
    syms.linkGenSrc()
    idea.genProject()
  }],
  '--eclipse': ['Generates project for Eclipse', () => {
    libs.prepare()
    mods.discover()
    console.error(String(mods))
    syms.linkGenSrc()
    solar.genProject()
  }],
  '--publish': ['Publish artifacts, zip archives and library JS files', () => {
    libs.prepare()
    mods.discover()
    pub.prepare()
    console.error(String(pub))
    pub.publish()
  }],
  '--mvn': ['Prints JSON info about Maven coordinates', (coords) => {
    let info = mvn.coords(coords).info
    console.log(JSON.stringify(info, null, 2))
  }],
  '--center': ['Generateds maven POMs/modules to deploy to Central and other stuff', (parentPom) => {
    libs.prepare()
    mods.discover()
    center.prepare()
    console.error(String(center))
    syms.linkGenSrc()
    center.genProjects(parentPom)
  }],
}, {
  before: (_, hint) => ops.info(`${hint}`),
  end: () => ops.ok('OK'),
  err: (e) => {
    ops.err(`FAIL ${e}`)
    if (ops.use.trace) {
      console.trace(e)
    }
  }
})

module.exports = {
  lib(target, jars, options) {
    libs.stage(target, jars, options)
    return this
  },
  zip(dir, options) {
    pub.zip(dir, options)
    return this
  },
  fatJar(target, options) {
    pub.fatJar(target, options)
    return this
  },
  addTargets(pattern) {
    mods.addTargets(pattern)
    return this
  },
  include(script) {
    libs.include(script)
    return this
  },
  grab(target, coords, options) {
    grab.stage(target, coords, options)
    return this
  },
  run() {
    opts(process.argv.slice(2))
  }
}
