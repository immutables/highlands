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

const opts = args({
  '--help': ['Prints usage and option hints', function() {
    this.usage()
  }, 1],
  '--trace': ['Enable tracing of command line calls and created files', () => {
    ops.use.trace = true
  }, 2],
  '--uplock': ['Use up.js library definitions to update lib lock', () => {
    libs.uplock()
  }, 5],
  '--lib': ['Generate library rules and jar symlinks', () => {
    libs.prepare()
    console.error(String(libs))
    libs.genBuckfiles()
    buck.fetchAll()
    syms.linkJars()
  }, 10],
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
  '--mvn': ['Prints JSON info about Maven coordinates', (coords) => {
    let info = mvn.coords(coords).info
    console.log(JSON.stringify(info, null, 2))
  }],
}, {
  before: (_, hint) => ops.info(`${hint}`),
  end: () => ops.ok('OK'),
  err: (e) => {
    ops.err(`ERR ${e}`)
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
  run() {
    opts(process.argv.slice(2))
  }
}
