'use strict'
const paths = require('path')
const ops = require('./ops')
const mvn = require('./mvn')

class Target {
  constructor(path, goal) {
    this.path = path
    this.goal = goal
  }

  toString() {
    return this.path ? `//${this.path}:${this.goal}` : `:${this.goal}`
  }

  get basename() {
    return this.path ? paths.basename(this.path) : ''
  }

  get pattern() {
    return `${this.path}/...`
  }

  get isDefault() {
    return this.basename === this.goal
  }

  get isLocal() {
    return !this.path
  }

  get abbr() {
    let suffix = this.isDefault ? '' : `:${this.goal}`
    return `${this.path}${suffix}`
  }

  at(path) {
    return new Target(paths.join(trimSlashes(path), this.path), this.goal)
  }

  withGoal(goal) {
    return new Target(this.path, goal)
  }
}

function trimSlashes(path) {
  return path.replace(/^[/]+/, '').replace(/[/]+$/, '')
}

function target(string) {
  let [p, g] = string.split(':')
  p = trimSlashes(p)
  g = g || paths.basename(p)
  if (!p && !g) throw `Wrong target specifier '${string}'`
  return new Target(p, g)
}

function flatname(input) {
  return String(input).replace(/[-.:]/g, '_')
}

function rulePrebuiltJar(jar, src) {
  let n = flatname(jar)
  if (src) return `
prebuilt_jar(
  name = '${n}',
  binary_jar = ':remote_${n}_jar',
  source_jar = ':remote_${n}_src',
  maven_coords = '${jar}',
)

remote_file(
  name = 'remote_${n}_jar',
  out = '${jar.filenameJar}',
  url = '${jar.remote}${mvn.EXT.jar}',
  sha1 = '${jar.checksumJar}',
)

remote_file(
  name = 'remote_${n}_src',
  out = '${src.filenameSrc}',
  url = '${src.remote}${mvn.EXT.src}',
  sha1 = '${src.checksumSrc}',
)
`
  else return `
prebuilt_jar(
  name = '${n}',
  binary_jar = ':remote_${n}_jar',
  maven_coords = '${jar}',
)

remote_file(
  name = 'remote_${n}_jar',
  out = '${jar.filenameJar}',
  url = '${jar.remote}${mvn.EXT.jar}',
  sha1 = '${jar.checksumJar}',
)
`
}

function ruleJavaLibrary(t, jars, options) {
  return `
java_library(
  name = '${t.goal}',
  exported_deps = [${(toBuckDeps(jars, options))}],
  visibility = ['PUBLIC'],
)
`
}

function toBuckDeps(jars, options) {
  return jars.map(j => `':${flatname(j)}'`)
      .concat((options.deps || []).map(target).map(d => `'${d}'`))
      .join(', ');
}

function ruleJavaAnnotationProcessor(t, jars, options) {
  if (options.processorLibrary) {
    return `
java_library(
  name = '${options.processorLibrary}',
  exported_deps = [${(toBuckDeps(jars, options))}],
  visibility = ['PUBLIC'],
)

java_annotation_processor(
  name = '${t.goal}',
  deps = [':${options.processorLibrary}'],
  processor_class = '${options.processor}',
  visibility = ['PUBLIC'],
)
`
  }
  return `
java_annotation_processor(
  name = '${t.goal}',
  deps = [${toBuckDeps(jars, options)}],
  processor_class = '${options.processor}',
  visibility = ['PUBLIC'],
)
`
}

function ruleJavaBinary(t, jars, options) {
  return `
java_binary(
  name = '${t.goal}',
  deps = [${toBuckDeps(jars, options)}],
  main_class = '${options.main}',
  visibility = ['PUBLIC'],
)  
`
}

function ruleRemoteFile(target, coords, type, ext, checksumExt) {
  return `
remote_file(
  name = '${target.goal}',
  out = '${coords.filename}${ext}',
  url = '${coords.remote}${ext}',
  sha1 = '${coords.checksumByExt(checksumExt)}',
  type = '${type}',
  visibility = ['PUBLIC'],
)
`
}

function rules(target, jars, srcs, options) {
  let mainRule;
  if (options.processor) {
    mainRule = ruleJavaAnnotationProcessor(target, jars, options);
  } else if (options.main) {
    mainRule = ruleJavaBinary(target, jars, options)
  } else {
    mainRule = ruleJavaLibrary(target, jars, options);
  }

  let prebuiltJars = jars.map((j, i) => rulePrebuiltJar(j, srcs[i]))
  return [mainRule, ...prebuiltJars]
}

function query(input, attrs) {
  attrs = attrs ? `--output-attributes ${attrs}` : ''
  return JSON.parse(ops.exec(`buck query "${input}" --json ${attrs}`))
}

let cachedInfo = {}

function dropCache() {
  cachedInfo = {}
}

function info(pattern) {
  return cachedInfo[pattern]
      || (cachedInfo[pattern] =
          JSON.parse(ops.exec(`buck targets "${pattern}" --json --show-output`)))
}

function fetch(pattern) {
  pattern = pattern || '//...'
  ops.exec(`buck fetch ${pattern}`)
}

const remote = {
  // alternative way is to hardcode Buck's internal paths
  // `/buck-out/bin/${target.path}/remote_${flatname(j)}_jar/${j.filenameJar}`
  jar(target, j) {
    return target.withGoal(`remote_${flatname(j)}_jar`)
  },
  src(target, j) {
    return target.withGoal(`remote_${flatname(j)}_src`)
  },
}

const attr = {
  qname: 'fully_qualified_name',
  type: 'buck.type',
  path: 'buck.base_path',
  name: 'name',
  out: 'out',
  outputPath: 'buck.outputPath',
  generatedSourcePath: 'buck.generatedSourcePath',
  directDependencies: 'buck.direct_dependencies',
  resourcesRoot: 'resourcesRoot',
  annotationProcessors: 'annotationProcessors',
  plugins: 'plugins',
  labels: 'labels',
  deps: 'deps',
  exportedDeps: 'exportedDeps',
  providedDeps: 'providedDeps',
  exportedProvidedDeps: 'exportedProvidedDeps',
  mavenCoords: 'mavenCoords',
}

module.exports = {
  target, rules, remote, attr, query, info, fetch, dropCache, ruleRemoteFile
}
