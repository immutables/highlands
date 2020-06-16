'use strict'
const paths = require('path')
const buck = require('./buck')
const libs = require('./libs')
const {err} = require('./ops')

const UNASSIGNED = '__UNASSIGNED__'

class Mod {
  constructor(path) {
    Object.assign(this, {
      path,
      name: UNASSIGNED, // should be assigned unique module name
      srcs: {}, // source folders, including test and generated source folders
      deps: {}, // collect dependencies
      depmods: {}, // collect set of modules as dependencies
      deplibs: {}, // collect set of libraries as dependencies
    })
  }

  toString() {
    return `//${this.path} [${this.name}] ${Object.keys(this.srcs).join(', ')}`
  }
}

const mods = {
  all: [],
  rootname: UNASSIGNED,
  addedTargets: [],

  add(mod) {
    this.all.push(mod)
  },

  addTargets(pattern) {
    this.addedTargets.push(pattern)
  },

  toString() {
    return ['Modules', ...this.all].map(String).join('\n\t')
  },

  discover() {
    if (this.all.length) return // already discovered
    // to force rediscovery clear this.all array

    let allTargets = buck.info('//...')
    for (let a of this.addedTargets) {
      allTargets.push(...buck.info(a))
    }
    let moduleByPath = {} // mapping from path/folder to a originating rule
    let moduleByTarget = {} // reverse mapping of which module target falls in

    collectModulePaths()
    defineSourcesAndDeps()
    defineGeneratedSources()
    assignModuleNames()
    wireDependencies()

    for (let p in moduleByPath) {
      this.add(moduleByPath[p])
    }

     // we're done here, hoisted private functions below

    function collectModulePaths() {
      for (let rule of allTargets) {
        let t = buck.target(rule[buck.attr.qname])
        if (isModuleOrigin(t, rule)) {
          moduleByPath[t.path] = new Mod(t.path)
        }
      }
    }

    function defineSourcesAndDeps() {
      for (let rule of allTargets) {
        let t = buck.target(rule[buck.attr.qname])
        let m = moduleByPath[t.path]
        if (!m) continue

        let isTest = isTestRule(rule)

        addSourceFolders(m.srcs, rule, isTest)
        mergeDeps(m.deps, depsOf(t, rule, isTest))

        moduleByTarget[String(t)] = m
      }
    }

    function addSourceFolders(srcs, rule, isTest) {
      let resFolder = rule[buck.attr.resourcesRoot]

      if (resFolder) {
        let existing = srcs[resFolder]
        srcs[resFolder] = {
          test: isTest || (existing ? existing.test : false),
          path: resFolder,
          res: hasLabel(rule, 'ide_res') ? {test:false}
            : hasLabel(rule, 'ide_test_res') ? {test:true}
            : false,
          gen: false,
        }
      }
    }

    function defineGeneratedSources() {
      // generated folders added in separate loop to precisely
      // determine if generated source folder is considered
      // "isTestGen" (if one of the contributing rules
      // to the base non-gen source folder is test rule)
      for (let rule of allTargets) {
        let t = buck.target(rule[buck.attr.qname])
        let m = moduleByPath[t.path]
        if (!m) continue

        let isTest = isTestRule(rule)
        addGeneratedSourceFolders(m.srcs, rule, isTest)
      }
    }

    function addGeneratedSourceFolders(srcs, rule, isTest) {
      let resFolder = rule[buck.attr.resourcesRoot]
      let isTestGen = isTest
      if (resFolder) {
        let existing = srcs[resFolder]
        isTestGen = isTest || (existing && existing.test)
      }
      let genPath = rule[buck.attr.generatedSourcePath]
      if (!genPath && isTest && usesCodegen(rule)) {
        // this is hardcoded edge-case due to some inconsistency in how Buck
        // not returning generatedSourcePath for test rules
        // https://github.com/facebook/buck/issues/2235
        genPath = `buck-out/annotation/${rule[buck.attr.path]}/__${rule[buck.attr.name]}#testsjar_gen__`
      }
      if (genPath && usesCodegen(rule) && !hasLabel(rule, 'ide_no_gen_srcs')) {
        let alias = resFolder || (isTestGen ? 'test' : 'src')
        putInc(srcs, `${alias}-gen`, {
          gen: true,
          path: genPath,
          test: isTestGen
        })
      }
    }

    function depsOf(target, rule, isTestRule) {
      let plainDeps = rule[buck.attr.deps] || []
      let providedDeps = rule[buck.attr.providedDeps] || []
      let exportedDeps = rule[buck.attr.exportedDeps] || []
      let exportedProvidedDeps = rule[buck.attr.exportedProvidedDeps] || []

      let deps = [
        ...plainDeps,
        ...providedDeps,
        ...exportedDeps,
        ...exportedProvidedDeps]
        .map(d => target.resolve(buck.target(d)))
        .reduce((ds, d) => (ds[d] = {target:d}, ds), {})

      for (let [k, dep] of Object.entries(deps)) {
        dep.test = isTestRule
        dep.provided = providedDeps.includes(k) || exportedProvidedDeps.includes(k)
        dep.exported = exportedDeps.includes(k) || exportedProvidedDeps.includes(k)
      }

      return deps
    }

    function mergeDeps(to, from) {
      let sharedKeys = Object.assign({}, to, from)

      for (let k in sharedKeys) {
        let a = to[k]
        let b = from[k]
        to[k] = (a && b) ? merge(a, b) : (a || b)
      }

      function merge(a, b) {
        let {test, provided, exported, ...rest} = a
        return {
          test: test && b.test, // if any rule in module use it not for test
          provided: provided && b.provided,
          exported: exported || b.exported,
          ...rest
        }
      }
    }

    function assignModuleNames() {
      mods.rootname = paths.basename(process.cwd())

      let bySimpleNames = {}

      for (let [p, m] of Object.entries(moduleByPath)) {
        let n = paths.basename(m.path)
        ;(bySimpleNames[n] || (bySimpleNames[n] = [])).push(m)
      }

      // we prefer simple name, but resort to path-derived name
      // in case of conflicts with root or between modules
      // in either case we ensure that there will be a unique
      // module name across project by using `putInc` routine
      // (otherwise there's a chance that name mangling
      // will still produce some duplicates)
      let uniqueNames = {}
      uniqueNames[mods.rootname] = {} // claimed ahead

      for (let [n, ms] of Object.entries(bySimpleNames)) {
        if (n === mods.rootname || ms.length > 1) {
          ms.forEach(m => assignUniqueName(m, pathDerivedName(m)))
        } else {
          ms.forEach(m => assignUniqueName(m, n))
        }
      }

      function pathDerivedName(m) {
        return m.path.replace(/[_/]/g, '-')
      }

      function assignUniqueName(m, name) {
        m.name = putInc(uniqueNames, name, m)
      }
    }

    function collectLibraryTransitiveDependencies(target) {
      if (!(target in libs.byTarget)) throw `Not in libs.byTarget: ${target}`

      let results = new Set()
      let unprocessed = [target]

      do {
        let l = unprocessed.shift()
        results.add(l)
        let deplib = libs.byTarget[l]
        for (let d of (deplib.options.deps || [])) {
          let t = deplib.target.resolve(buck.target(d)).toString()
          if ((t in libs.byTarget) && !results.has(t)) {
            unprocessed.push(t)
          }
          // it occurs to me that under current model, we cannot
          // properly propagate library's dependency on a [ide] module,
          // only to other external or internal libraries, should be fine though
        }
      } while (unprocessed.length > 0)

      return [...results]
    }

    function wireDependencies() {
      for (let [p, m] of Object.entries(moduleByPath)) {
        for (let [t, dep] of Object.entries(m.deps)) {
          let resolved = false
          // resolve dependency as sibling module in project workspace
          if (t in moduleByTarget) {
            let mod = moduleByTarget[t]
            if (mod !== m) {
              // in case of local dependency, we cannot add dependency on self module
              // only dependency on local internal libs (to be jar compiled) are supported
              // but we mark dependency resolved anyway
              m.depmods[mod.path] = Object.assign({}, dep, {mod})
            }
            resolved = true
          }
          // and / or as dependency to a jar library (external/3rdparty or prebuilt internal)
          // if both module and library dependency are not desired at the same time
          // it's better to manage these dependencies, potentially, by
          // making module reexport same dependencies instead of using library directly
          if (t in libs.byTarget) {
            let deplibs = collectLibraryTransitiveDependencies(t)
                .reduce((r, depkey) => {
                  r[depkey] = Object.assign({}, dep, {lib: libs.byTarget[depkey]})
                  return r
                }, {})

            mergeDeps(m.deplibs, deplibs)

            resolved = true
          }

          if (!resolved) {
            let bt = buck.target(t)
            if (bt.isLocal || bt.path == m.path) {
              // local dependency should be implicit in IDE module
              // or it should have been an internal library
            } else err(`${p}: Unresolvable dependency ${t}`)
          }
        }
      }
    }

    // could only think of convention rule named `*_test`
    // obviously would work fine for java_test and kotlin_test etc
    // any other ways to distinguish test rules?
    function isTestRule(rule) {
      return /.+_test$/.test(rule[buck.attr.type] || '')
    }

    function hasLabel(rule, label) {
      return (rule[buck.attr.labels] || []).includes(label)
    }

    function isModuleOrigin(target, rule) {
      return target.isDefault
          && (rule[buck.attr.resourcesRoot] || hasLabel(rule, 'ide_mod'))
    }

    function usesCodegen(rule) {
      return notEmpty(rule[buck.attr.plugins])
          || notEmpty(rule[buck.attr.annotationProcessors])
    }

    function putInc(object, field, value) {
      for (let s = '';; s = String((+s || 0) + 1)) {
        let alias = field + s
        if (!(alias in object)) {
          object[alias] = value
          return alias
        }
      }
    }

    function notEmpty(arr) {
      return !!arr && arr.length > 0
    }
  }
}

module.exports = mods
