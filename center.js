'use strict'

const paths = require('path')
const ops = require('./ops')
const libs = require('./libs')
const mods = require('./mods')
const buck = require('./buck')
const mvn = require('./mvn')

const javaRules = {java_library: true, kotlin_library: true}

function targetOf(a) { return a[buck.attr.qname] }

function pathOf(a) { return a[buck.attr.path] }

function jarOf(a) { return a[buck.attr.mavenCoords] }

function ruleOf(a) { return a[buck.attr.type] }

function quote(a) { return `'${a}'` }

let conf, artifacts, artifactModules

const defaultVersion = '0-SNAPSHOT', defaultGroup = 'group'

function parentVersion() {
  return conf['maven.publish_ver'] || defaultVersion
}

function parentGroup() {
  return conf['maven.publish_group'] || defaultGroup
}

function parentArtifact(parentPom) {
  let p = parentPom.replace('.xml', '')
      .replace('.pom', '')
      .replace(/\//g, '')
      .replace(/\./g, '')
  return p === 'pom' ? 'parent' : p
}

function prepare() {
  if (artifacts) return // noop if already consumed stagedObjects

  conf = buck.conf()
  artifacts = buck.info(`//...`)
      .filter(t => ruleOf(t) in javaRules && jarOf(t))
      .reduce((acc, rule) => (acc[pathOf(rule)] = rule, acc), {})

  artifactModules = mods.all.filter(m => m.path in artifacts)
}


function genProjects(parentPom) {
  console.log('Parent POM:', parentPom)
  generateParentTemplate(parentPom)
  for (let a of artifactModules) {
    generatePom(a, artifacts[a.path], parentPom)
  }
}

function generateParentTemplate(parentPom) {
  let template = parentPom.replace('.xml', '.template.xml')
  if (ops.exists(template)) {
    let content = ops.read(template)
      .replace('G<!--GROUP-->', parentGroup())
      .replace('A<!--ARTIFACT-->', parentArtifact(parentPom))
      .replace('V<!--VERSION-->', parentVersion())
      .replace('<!--MODULES-->', artifactModules.map(m => `
    <module>${m.path}</module>`).join(''))

    ops.write(parentPom, content)
  }
}

function generatePom(module, rule, parentPom) {
  let coords = mvn.coords(jarOf(rule))
  // for each
  let relativePath = '../' + parentPom
  for (let ch of module.path) {
    if (ch === '/') relativePath = '../' + relativePath
  }
  let content = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>${coords.group}</groupId>
  <artifactId>${coords.artifact}</artifactId>
  <version>${coords.version}</version>
  <packaging>jar</packaging>
  <name>\${project.groupId}.\${project.artifactId}</name>
  <parent>
    <groupId>${parentGroup()}</groupId>
    <artifactId>${parentArtifact(parentPom)}</artifactId>
    <version>${parentVersion()}</version>
    <relativePath>${relativePath}</relativePath>
  </parent>
  <dependencies>${pomDependencies(module)}
  </dependencies>
</project>
`
  ops.write(paths.join(module.path, 'pom.xml'), content)
}

function pomDependencies(module) {
  let deps = []

  for (let [path, dep] of Object.entries(module.depmods)) {
    let jar = jarOf(artifacts[path] || {})
    if (jar) {
      let coords = mvn.coords(jar)
      deps.push(`
    <dependency>
      <groupId>${coords.group}</groupId>
      <artifactId>${coords.artifact}</artifactId>
      <version>${coords.version}</version>${classifier(coords)}${scope(dep)}
    </dependency>`)
    }
  }

  for (let [path, dep] of Object.entries(module.deplibs)) {
    for (let coords of dep.lib.jars) {
      deps.push(`
    <dependency>
      <groupId>${coords.group}</groupId>
      <artifactId>${coords.artifact}</artifactId>
      <version>${coords.version}</version>${classifier(coords)}${scope(dep)}
    </dependency>`)
    }
  }

  return deps.join('')

  function scope(dep) {
    if (dep.test) return `
      <scope>test</scope>`
    if (dep.provided && dep.exported) return `
      <scope>provided</scope>`
    if (dep.provided) return `
      <scope>provided</scope>
      <optional>true</optional>`
    if (dep.exported) return `
      <scope>compile</scope>`
    return `
      <scope>compile</scope>
      <optional>true</optional>`
  }

  function classifier(coords) {
    return coords.classifier ? `
      <classifier>${coords.classifier}</classifier>` : ''
  }
}

module.exports = {
  prepare, genProjects,

  toString() {
    return [
        'Pom Modules',
        ...artifactModules.map(m => '\t' + String(m)),
        'Artifacts',
        ...Object.values(artifacts).map(t => '\t' + targetOf(t) + ' [' + jarOf(t) + ']'),
    ].join('\n')
  }
}
