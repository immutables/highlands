'use strict'
const mods = require('./mods')
const ops = require('./ops')
const buck = require('./buck')

const testAttribute = `<attributes><attribute name="test" value="true"/></attributes>`

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
  let level = buck.javaLevel()
  let folders = []

  for (let p of Object.keys(m.srcs).sort()) {
    let f = m.srcs[p]
    if (f.test) {
      folders.push(`
    <classpathentry kind="src" path="${p}" output=".ecj/test-classes">
      ${testAttribute}
    </classpathentry>`)
    } else {
      folders.push(`
    <classpathentry kind="src" path="${p}"/>`)
    }
  }

  let depmods = []

  for (let d of Object.values(m.depmods)) {
    depmods.push(`
  <!-- ${d.mod.path}  ${d.mod.name} -->
  <classpathentry kind="src" path="/${projectName(d.mod)}"${d.exported ? ' exported="true"':''} combineaccessrules="false"/>`)
  }

  let deplibs = []

  for (let d of Object.values(m.deplibs)) {
    for (let i in d.lib.jars) {
      let j = d.lib.jars[i]
      let s = d.lib.srcs[i]
      let jarpath = ` path="/${mods.rootname}/${d.lib.symlinkJar(j)}"`
      let sourcepath = s ? ` sourcepath="/${mods.rootname}/${d.lib.symlinkSrc(s)}"` : ''
      let exported = d.exported ? ' exported="true"':''
      let testAndClosing = d.test ? `>
      ${testAttribute}
  </classpathentry>`: '/>'

      deplibs.push(`
  <!-- ${d.lib.name}  ${j} -->
  <classpathentry kind="lib"${jarpath}${sourcepath}${exported}${testAndClosing}`)
    }
  }

  let deps = [...depmods, ...deplibs]

  return `<?xml version="1.0" encoding="UTF-8"?>
<classpath>${folders.join('')}
  <classpathentry kind="con" path="org.eclipse.jdt.launching.JRE_CONTAINER/org.eclipse.jdt.internal.debug.ui.launcher.StandardVMType/JavaSE-${level.source}"/>${deps.join('')}
  <classpathentry kind="output" path=".ecj/classes"/>
</classpath>
`
}

function projectName(m) {
  return m.path.replace(/\//g, '.')
}

module.exports = {
  genProject() {
    ops.write('.project', dotProject(mods.rootname, {
      projects: mods.all.map(projectName)
    }))
    for (let m of mods.all) {
      ops.write(`${m.path}/.project`, dotProject(projectName(m), {
        natures: 'java',
        projects: Object.values(m.depmods).map(m => projectName(m.mod))
      }))
      ops.write(`${m.path}/.classpath`, dotClasspath(m))
    }
  },
}
