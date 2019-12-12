'use strict'

const ops = require('./ops')
const buck = require('./buck')
const mods = require('./mods')
const libs = require('./libs')

const env = {
  username: 'PUBLISH_USER',
  password: 'PUBLISH_PASSWORD',
  repository: 'PUBLISH_REPOSITORY',
}

const repository = process.env[env.repository] || 'file://.artifacts'
const outDir = '.out'
const javaRules = {'java_library': true, 'kotlin_library': true}

const stagedDirs = []
let dirs
let conf
let artifacts

class Zip {

  constructor(dir, options) {
    this.dir = dir
    this.options = options
  }

  get version() {
    let v = version()
    return v ? '-' + v : ''
  }

  get filename() {
    return `${this.dir}${this.version}.zip`
  }

  push() {
    console.log(ops.exec(`echo "${env.username}=$${env.username} ${env.password}=$${env.password} ${env.repository}=$${env.repository}"`))
    let source = this.dir

    // http://localhost:8081/artifactory/my-repository/my/new/artifact/directory/file.txt
//    exec(`curl --fail --connect-timeout ${ops.use.timeout} -u $${env.username}:$${env.password} -X PUT "${url.....}/zip" -T ${this.archive}`)
  }

  pack() {
    let source = this.dir
    ops.mkdirs(outDir)

    let archive = `${outDir}/${this.filename}`
    let exclude = [].concat(this.options.exclude || []).map(x => `-x '${x}'`).join(' ')

    ops.unlink(archive)

    ops.exec(`zip -r ${archive} ${source} ${exclude}`)
  }

  toString() {
    return `${this.dir}.zip`
  }
}

function version() {
  return conf['maven.publish_ver']
}

function zip(dir, options) {
  options = options || {}
  stagedDirs.push(new Zip(trimSlashes(dir), options))
}

function exportLibraries() {
  let libraryDefs = libs.all.map(a => `
    .lib('${a.target}', ${strings(a.jars)}${options(a.options)})`)

  let content = `// Generated by 'node up --pub'
module.exports = function(up) { up${libraryDefs.join('')}
}
`
  ops.write(`${outDir}/lib-${version()}.js`, content)
}

function exportModules() {
  let libraryDefs = artifacts.map(a => `
    .lib('${targetOf(a)}', ${strings(jarOf(a))}${options(optionsOf(a))})`)

  let content = `// Generated by 'node up --pub'
const repo = '${repository}'
module.exports = function(up) { up${libraryDefs.join('')}
}
`
  ops.write(`${outDir}/pub-${version()}.js`, content)

  function optionsOf(a) {
    let deps = buck.query(`deps('${targetOf(a)}', 1, first_order_deps())`)
    if (deps.length) return { deps, repo: '<&>' }
    return {}
  }
}

function targetOf(a) { return a[buck.attr.qname] }

function jarOf(a) { return a[buck.attr.mavenCoords] }

function ruleOf(a) { return a[buck.attr.type] }

function quote(a) { return `'${a}'` }

function options(o) {
  let ks = Object.keys(o)
  if (!ks.length) return ''
  let attrs = []
  for (let k of ks) {
    let v = k == 'deps' ? strings(o[k], '  ') : JSON.stringify(o[k])
    if (v == `"<&>"`) attrs.push(`
      ${k},`)
    else attrs.push(`
      ${k}: ${v},`)
  }
  return `, {${attrs.join('')}
    }`
}

function strings(strings, indent) {
  strings = [].concat(strings)
  if (strings.length < 2) return quote(strings[0])
  let elements = strings.map(s => `
      ${indent || ''}${quote(s)},`)
  return `[${elements.join('')}
    ${indent || ''}]`
}

function prepare() {
  if (dirs) return // noop if already consumed stagesDir

  dirs = stagedDirs
  conf = JSON.parse(ops.exec(`buck audit config maven --json`))
  // Only jars we want to publish will end up here
  // we will not pickup generated libraries here as thay have
  // maven_coords on a prebuilt_jar rule, not on a corresponding java_library
  artifacts = buck.info(`//...`)
      .filter(t => ruleOf(t) in javaRules && jarOf(t))
}

function trimSlashes(path) {
  return path.replace(/^[/]+/, '').replace(/[/]+$/, '')
}

function publishArtifacts() {
  ops.mkdirs(`.artifacts`)

  for (let t of artifacts) {
    console.log(ops.exec(`buck publish ${targetOf(t)} --remote-repo ${repository}`))
    // console.log(ops.exec(`buck publish ${target} --username $${env.username} --password $${env.password} --remote-repo $${env.repository}`))
  }
}

function publish() {
  exportLibraries()
  exportModules()

  dirs.forEach(d => d.pack())
  publishArtifacts()
  dirs.forEach(d => d.push())
}

module.exports = {
  prepare, zip, publish,

  toString() {
    return dirs.map(String).join('\n')
  }
}
