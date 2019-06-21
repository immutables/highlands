'use strict'
const paths = require('path')
const ops = require('./ops')
const libs = require('./libs')
const mods = require('./mods')

function libraryXml(lib) {
  let classesRoots = lib.jars.map(j => `
      <root url="jar://$PROJECT_DIR$/${lib.symlinkJar(j)}!/" />`)

  let sourcesRoots = lib.srcs.map(j => `
      <root url="jar://$PROJECT_DIR$/${lib.symlinkSrc(j)}!/" />`)

  return `<?xml version="1.0" encoding="UTF-8"?>
<component name="libraryTable">
  <library name="${lib.name}">
    <CLASSES>${classesRoots.join('')}
    </CLASSES>
    <JAVADOC />
    <SOURCES>${sourcesRoots.join('')}
    </SOURCES>
  </library>
</component>
`
}

function moduleMainXml(excludes) {
  let excludesFolders = excludes.map(dir => `
<excludeFolder url="file://$MODULE_DIR$/../../${dir}" isTestSource="false" />`)

  return `<?xml version="1.0" encoding="UTF-8"?>
<module type="JAVA_MODULE" version="4">
  <component name="NewModuleRootManager" inherit-compiler-output="true">
    <exclude-output />
    <content url="file://$MODULE_DIR$/../..">${excludesFolders}
    </content>
    <orderEntry type="inheritedJdk" />
    <orderEntry type="sourceFolder" forTests="false" />
    <orderEntry type="sourceFolder" forTests="true" />
  </component>
</module>
`
}

function moduleXml(mod) {
  let excludesFolders = ['.out']
      .filter(dir => ops.exists(paths.join(mod.path, dir)))
      .map(dir => `
      <excludeFolder url="file://$MODULE_DIR$/../../${mod.path}/${dir}" isTestSource="false" />`)

  let folders = Object.entries(mod.srcs).map(([p, f]) => `
      <sourceFolder url="file://$MODULE_DIR$/../../${mod.path}/${p}" ${folderAttributes(f)}/>`)

  let depmods = toValues(mod.depmods).map(d => `
    <orderEntry type="module" module-name="${d.mod.name}"
        scope="${scope(d)}" ${d.exported ? ' exported=""':''} />`)

  let deplibs = toValues(mod.deplibs).map(d => `
    <orderEntry type="library" name="${d.lib.name}"
        scope="${scope(d)}" level="project"${d.exported ? ' exported=""':''}/>`)

  let deps = [...deplibs, ...depmods]

  return `<?xml version="1.0" encoding="UTF-8"?>
<module type="JAVA_MODULE" version="4">
  <component name="NewModuleRootManager" inherit-compiler-output="true">
    <exclude-output />
    <content url="file://$MODULE_DIR$/../../${mod.path}">${folders.join('')}${excludesFolders.join('')}
    </content>
    <orderEntry type="inheritedJdk" />
    <orderEntry type="sourceFolder" forTests="false" />${deps.join('')}
  </component>
</module>
`
  function toValues(o) {
    return Object.keys(o).map(k => o[k])
  }

  function scope(dep) {
    if (dep.test) return 'TEST'
    if (dep.provided) return 'PROVIDED'
    return 'COMPILE'
  }

  function folderAttributes(f) {
    if (f.res) return f.res.test ? `type="java-test-resource"` : `type="java-resource"`
    return `isTestSource="${f.test}" generated="${f.gen}"`
  }
}

function modulesAllXml(mods) {
  let element = n => `
     <module fileurl="file://$PROJECT_DIR$/.idea/modules/${n}.iml" filepath="$PROJECT_DIR$/.idea/modules/${n}.iml" />`

  let modules = [element(mods.rootname), ...mods.all.map(m => element(m.name))]

  return `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="ProjectModuleManager">
    <modules>${modules}
    </modules>
  </component>
</project>
`
}

function miscXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="ProjectRootManager" version="2" default="false" languageLevel="JDK_1_8" project-jdk-name="1.8" project-jdk-type="JavaSDK">
    <output url="file://$PROJECT_DIR$/.idea/.out" />
  </component>
</project>
`
}

function kotlincXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="Kotlin2JvmCompilerArguments">
    <option name="jvmTarget" value="1.8" />
  </component>
</project>
`
}

module.exports = {
  genProject() {
    this.genLibs()
    this.genModules()
  },

  genLibs() {
    for (let l of libs.all) {
      ops.write(`.idea/libraries/${l.flatname}.xml`, libraryXml(l))
    }
  },

  genModules() {
    for (let m of mods.all) {
      ops.write(`.idea/modules/${m.name}.iml`, moduleXml(m))
    }
    ops.write(`.idea/modules/${mods.rootname}.iml`, moduleMainXml(this.excluded()))
    ops.write('.idea/modules.xml', modulesAllXml(mods))
    // It's questionable if we need to generate misc.xml
    // Helps to get initial project setup with some SDKs (Java 8 SDK currently)
    // But may conflict by overriding other settings (like JavaScript language level)
    if (!ops.exists('.idea/misc.xml')) {
      ops.write('.idea/misc.xml', miscXml())
    }
    if (!ops.exists('.idea/kotlinc.xml')) {
      ops.write('.idea/kotlinc.xml', kotlincXml())
    }
  },

  // all folders at project root which do not contain modules
  excluded() {
    let excludes = ops.ls()
        .filter(l => l.isDirectory())
        .reduce((acc, l) => (acc[l.name] = true, acc), {})

    for (let m of mods.all) {
      let dir = m.path.split('/')[0]
      delete excludes[dir]
    }

    return Object.keys(excludes)
  }
}
