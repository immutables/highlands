'use strict'
const mods = require('./mods')
const ops = require('./ops')

function dotProject(name, options) {
  options = options || {}
  let natures = [].concat(options.natures || [])
  let projects = [].concat(options.projects || [])

  let projectRefs = ''
  let projectNatures = ''
  let buildSpecs = ''

  for (let p of projects) {
    projectRefs += `
    <project>${p}</project>`
  }

  if (natures.includes('java')) {
    buildSpecs += `
    <buildCommand>
      <name>org.eclipse.jdt.core.javabuilder</name>
      <arguments></arguments>
    </buildCommand>`

    projectNatures += `
    <nature>org.eclipse.jdt.core.javanature</nature>`
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<projectDescription>
  <name>${name}</name>
  <comment></comment>
  <projects>${projectRefs}
  </projects>
  <buildSpec>${buildSpecs}
  </buildSpec>
  <natures>${projectNatures}
  </natures>
</projectDescription>
`
}

function dotClasspath(m) {
  let folders = []

  for (let p of Object.keys(m.srcs).sort()) {
    folders.push(`
  <classpathentry kind="src" path="${p}"/>`)
  }

  let depmods = []

  for (let d of toValues(m.depmods)) {
    depmods.push(`
  <!-- ${d.mod.path}  ${d.mod.name} -->
  <classpathentry kind="src" path="/${projectName(d.mod)}"${d.exported ? ' exported="true"':''} combineaccessrules="false"/>`)
  }

  let deplibs = []

  for (let d of toValues(m.deplibs)) {
    for (let i in d.lib.jars) {
      let j = d.lib.jars[i]
      let s = d.lib.srcs[i]
      let jarpath = ` path="/${mods.rootname}/${d.lib.symlinkJar(j)}"`
      let sourcepath = s ? ` sourcepath="/${mods.rootname}/${d.lib.symlinkSrc(s)}"` : ''
      let exported = d.exported ? ' exported="true"':''

      deplibs.push(`
  <!-- ${d.lib.name}  ${j} -->
  <classpathentry kind="lib"${jarpath}${sourcepath}${exported}/>`)
    }
  }

  let deps = [...depmods, ...deplibs]

  return `<?xml version="1.0" encoding="UTF-8"?>
<classpath>${folders.join('')}
  <classpathentry kind="con" path="org.eclipse.jdt.launching.JRE_CONTAINER/org.eclipse.jdt.internal.debug.ui.launcher.StandardVMType/JavaSE-1.8"/>${deps.join('')}
  <classpathentry kind="output" path=".classes"/>
</classpath>
`
}

function projectName(m) {
  return `${mods.rootname}.${m.name}`
}

function toValues(o) {
  return Object.keys(o).map(k => o[k])
}

module.exports = {
  genProject() {
    ops.write('.project', dotProject(mods.rootname, {
      projects: mods.all.map(projectName)
    }))
    for (let m of mods.all) {
      ops.write(`${m.path}/.project`, dotProject(projectName(m), {
        natures: 'java',
        projects: toValues(m.depmods).map(m => projectName(m.mod))
      }))
      ops.write(`${m.path}/.classpath`, dotClasspath(m))
    }
  },
}
