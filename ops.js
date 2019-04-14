'use strict'
const fs = require('fs')
const paths = require('path')
const childProcess = require('child_process')

const c = {
  dim: '\x1b[2m',
  res: '\x1b[0m',
  red: '\x1b[31m',
  grn: '\x1b[32m',
  yel: '\x1b[33m',
  blu: '\x1b[34m',
  mag: '\x1b[35m',
  cyn: '\x1b[36m',
}

const use = {
  workdir: process.cwd(),
  trace: false,
  timeout: 3, // seconds
}

function ls(path) {
  path = path || './'
  if (use.trace) process.stderr.write(`${c.yel}${c.dim}list?${c.res} ${c.yel}${path}${c.res}\n`)
  return fs.readdirSync(path, {withFileTypes: true})
}

function info(message) {
  process.stderr.write(`${c.yel}${message}${c.res}\n`)
}

function ok(message) {
  process.stderr.write(`${c.grn}${message}${c.res}\n`)
}

function err(message) {
  process.stderr.write(`${c.red}${message}${c.res}\n`)
}

function exec(command) {
  if (use.trace) process.stderr.write(`${c.mag}${c.dim}exec$${c.res} ${c.mag}${command}${c.res}\n${c.yel}${c.dim}`)
  let stdout = childProcess.execSync(command, {
    encoding: 'utf-8', stdio: [
      /*stdin*/'pipe',
      /*stdout*/'pipe',
      /*stderr*/use.trace ? 'inherit' : 'ignore'
    ]
  })
  if (use.trace) process.stderr.write(`${c.res}`)
  return stdout
}

function symlink(path, target, type) {
  if (use.trace) process.stderr.write(`${c.cyn}${c.dim}link>${c.res} ${c.cyn}${path}${c.dim} -> ${target}${c.res}\n`)
  path = paths.join(use.workdir, path)
  target = paths.join(use.workdir, target)
  mkdirs(paths.dirname(path))
  try {
    if (fs.lstatSync(path).isSymbolicLink()) {
      fs.unlinkSync(path)
    }
  } catch (_) {}
  fs.symlinkSync(target, path, type || 'file')
}

function mkdirs(d) {
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, {recursive: true})
  }
}

function exists(path) {
  if (use.trace) process.stderr.write(`${c.yel}${c.dim}exst?${c.res} ${c.yel}${path}${c.res}\n`)
  path = paths.join(use.workdir, path)
  return fs.existsSync(path)
}

function write(path, content) {
  if (use.trace) process.stderr.write(`${c.blu}${c.dim}file>${c.res} ${c.blu}${path}${c.res}\n`)
  path = paths.join(use.workdir, path)
  mkdirs(paths.dirname(path))
  fs.writeFileSync(path, content, 'utf-8')
}

function read(path) {
  if (use.trace) process.stderr.write(`${c.blu}${c.dim}file<${c.res} ${c.blu}${path}${c.res}\n`)
  path = paths.join(use.workdir, path)
  return fs.readFileSync(path, {encoding: 'utf-8'})
}

// in the scope of a single script execution is just
// fine to cache any fetch
const fetchCache = {}

function fetch(url) {
  return fetchCache[url] || (fetchCache[url] = exec(`curl --fail --connect-timeout ${use.timeout} ${url}`))
}

module.exports = {
  exec, info, ok, err, fetch, ls, read, write, exists, symlink, use
}
