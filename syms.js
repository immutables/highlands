'use strict'
const paths = require('path')
const buck = require('./buck')
const mods = require('./mods')
const ops = require('./ops')

const outputRules = ['remote_file', 'genrule', 'java_binary', 'http_file']

module.exports = {

  outputOf(r) {
    return outputRules.includes(r[buck.attr.type]) && r[buck.attr.outputPath]
  },

  linkOutput(targets) {
    targets = targets || '//...'
    let rules = buck.info(targets)

    for (let r of rules) {
      if (outputRules.includes(r[buck.attr.type])) {
        let output = r[buck.attr.outputPath] || '__no_output__'
        let file = r[buck.attr.out] || `${r[buck.attr.name]}.jar`
        let path = r[buck.attr.path]
        ops.symlink(paths.join(path, '.out', file), output)
      }
    }
  },

  // Creates symlink folder with generated code
  // targeting generated sources output somewhere under buck-out
  // Requires mods.discover() to be executed prior
  linkGenSrc() {
    for (let m of mods.all) {
      for (let [p, folder] of Object.entries(m.srcs)) {
        if (folder.gen) {
          ops.symlink(
            paths.join(m.path, p),
            folder.path,
            'dir')
        }
      }
    }
  },
}
