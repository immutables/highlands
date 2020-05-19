<div align="right"><em>
My heart's in the Highlands, my heart is not here,<br>
My heart's in the Highlands a-chasing the deer -<br>
A-chasing the wild deer, and following the roe;<br>
My heart's in the Highlands, wherever I go.<br>
— Robert Burns
</em></div>

# Highlands for Facebook Buck

_Highlands_ is a set of scripts used to manage Facebook Buck project workspace in a certain manner.

* Generates library definition from Maven Central artifacts and maintaining supplementary lock file. The generated lock file (JSON) and library definitions (comprised of `BUCK` files with `prebuilt_jar` and `remote_file` rules) then stored in Git, so that reliable and reproducible builds are possible. Such libraries are defined using simple DSL-ish calls in "up" file and can easily be updated and regenerated.

* Generates decent Java projects and modules for Intellij IDEA and Eclipse IDEs. Annotation processing is supported by linking generated source folders.

* Gets basic info on Maven Central artifacts in JSON format.

## Usage

Up to date version of Node JS is required to be installed. For example, `brew install node` on Mac with Homebrew will be just fine.
_Highlands_ scripts are self-sufficient and dependency-less, i.e. do not have any remote npm modules to be downloaded, only standard Node modules are used. To install this set of scripts — just copy them. You can use tagged released archives to download the same file

Given that current directory is Buck project root dir and there's "up" file (see below), usage is just call `node` on the `up` script.

```
$ node up --help

Usage: <this-cmd> [<options>]
    --help      Prints usage and option hints
    --trace     Enable tracing of command line calls and created files
    --uplock    Use up.js library definitions to update lib lock
    --lib       Generate library rules and jar symlinks
    --intellij  Generates project for Intellij IDEA
    --eclipse   Generates project for Eclipse
    --mvn       Prints JSON info about Maven coordinates
```

All output goes to `stderr`, except for JSON output of `--mvn` command which goes to `stdout` so it can be redirected to a file etc. Successful execution returns 0 status as expected.

#### Upgrade and regenerate libraries

Edit `up.js` so library definitions will be updated, then run lock-file update and refresh library BUCK files

```
$ node up --uplock --lib
```

#### Generate project for Intellij IDEA

Use the flag for `--intellij`. Make sure libs are already generated/exists in the repo.

```
$ node up --intellij
```

#### Maven artifact info

```
$ node up --mvn org.immutables:value:2.7.3
{
  "coords": "org.immutables:value:2.7.3",
  "groupId": "org.immutables",
  "artifactId": "value",
  "version": "2.7.3",
  "jar": {
    "uri": "https://repo1.maven.org/maven2/org/immutables/value/2.7.3/value-2.7.3.jar",
    "sha1": "91d271437be1e14438a2da6c5c3e9f8db061a7b9"
  },
  "sources": {
    "uri": "https://repo1.maven.org/maven2/org/immutables/value/2.7.3/value-2.7.3-sources.jar",
    "sha1": "da58a1979724a3d20ab976762faf640d3e463493"
  }
}
```

## "Up" file

The entry point for script execution is "up" file. The actual name can be different, but for simplity let's assume it's will be just `up.js`. It contain require instruction to import _Highlands_ script, DSL-ish function calls to define libraries and finalizing `run()` to perform actions. Actions are specified by command line options (see usage).

```js
// up.js file, put it to the root folder
// require by relative name to downloaded dir with scripts,
// ending slash in the path is a must for index.js to be picked
require('./highlands/')
  .lib('//lib/some/library', 'group:artifact:version')
  .lib('//lib/other/library:classifier', 'group:artifact:classifier:version')
  .lib('//lib/junit', ['junit:junit:4.12', 'org.hamcrest:hamcrest-core:1.3']))
  .run() // <- finishing move, required to launch the script execution
```
### ".lib" definition

```js
.lib('//lib/some/library', 'group:artifact:version', options)
```

Library definition contains library's canonical Buck path. By convention, if `:target` part is omitted it is considered the same as last segment of a path, so `//lib/one` is equivalent to `//lib/one:one` and is so called default target. Non-default targets are also supported and can be used for classifier jars or logically "sibling" jars/flavors. The example uses `//lib/` shared suffix for such libraries and it is not mandatory — use the path you want, but it's usually a good idea to have such common prefix (`//lib`, `//extern`, `//third-party/` etc are commonly used).
Then, as second argument, Maven coordinates string in the form of `<groupId>:<artifactId>:<version>` or `<groupId>:<artifactId>:<classifier>:<version>` is used to specify artifact in Maven Central. More than one artifact can be used if wrapped in an array. All such artifacts will comprise a single Buck library with a given path. No transitive dependencies are resolved, so, please, collect all needed dependencies in an array and/or add additional libraries as dependencies via `options.deps` see below.
The third, optional, argument is used to pass options:

* `options.deps` additional dependencies for the lib rules can be passed in form of an array of Buck targets. These are added as exported dependencies to the library rule

* `options.processor` can specify Java annotation processor class. The processor option will turn a lib into an annotation processor "plugin". Plugins are added as `plugins` attribute array to a `java_library` rule. Additional `options.processorLibrary` used to add local rule name to define intermediate annotation processor library which can be used by external rules as a library as opposed to a plugin, the plugin will also be defined in this case but it will also add this processor library as dependency.

```js
// Immutables annotation processor example
.lib('//lib/immutables/value', 'org.immutables:value:2.7.3', {
  processor: 'org.immutables.processor.ProxyProcessor'
})
```

* `options.srcs` can be used to specify alternative artifacts used to attach as source jars. The option accepts an array of Maven coordinates or a single Maven coordinates string. The number of src elements should be exactly the same as for library jars (second argument to `.lib` call) and have corresponding order, so they can be matched by position. This, probably, is a very rare case to hit, but can be useful if you need to use specific repackaged artifact for which there are no sources, but there are sources for a regular artifact. Also, an empty array can be supplied to suppress using source jars (in this case rule to have the same number of src jars as library jars does not apply).

* `options.repo` allows to specify remote repository for an artifact. Accepts uri prefix (no auto-slashes auto-added, leave trailing one) or a special values such as `'central'` for Maven Central and `jcenter` for Bintray's JCenter. When not specified, the default is to use Maven Central. The repo will be used for all artifacts in this library.

* `options.internal = true` internal flag turn treats this library as internal to the repo, rather than downloaded external one. It is expected that there are rules which output jars under the library path. Example: for internal library `//some/target:goal` we will expect output files available `goal.jar` and `goal.src.jar` for rules in this folder (`/some/target`).  `options.jar` and `options.src` can be used to override these names, this is not tied to any existing rule names and their `out` filename, however those should eventually match to build output of targets in the folder. When generating IDE files, library will reference class and src jars as (generated) symlinks under `//some/target/.out` folder.

## "Lock" file and libraries

`.up.lock.json` file is generated in the repository/project directory. By default all option-commands use preexisting `.up.lock.json` and if it's missing there will be an error. If `--uplock` option is specified, definitions from `up.js` will be used to query for checksums from Maven Central and regenerate lock file. Make sure to call this command when connection is secure etc. In theory lock file can be redundant if we can fully encode the information in generated BUCK libraries (see `--lib` option), however, consolidated lock file is easier to deal with in practice. Both lock file and generated libraries should be checked in repository, so whenever repository is checked out, clean reproducible build can be performed. This assumes that `buck fetch` command can download and cache remote artifacts. `--lib` option will call `buck fetch //...` automatically.

In addition to library BUCK files, there will be `.out/` directory generated along each BUCK file containing `remote_file` and/or `java_binary`. This `.out/` directory contains symlinks to jars stored deep inside `buck-out/`. The names of the jars are derived either from `out` attribute or a target name. Having these jar symlinks is useful for ad hoc build tools and scripts, for making references from IDE project files etc. We trying to avoid relying on the particular internal structure of `buck-out/` storage. These destination paths inside `buck-out/` are not hardcoded by _Highlands_ scripts, but queried from Buck itself. It's recommended to keep `.out/` out of the source code repo (git ignore) so they can be easily regenerated by `--lib`.

## IDE projects

Calling `node up --intellij` or `node up --eclipse` will generate project and module files for respective IDEs.
Common for both IDEs is the way in which modules are discovered. The module is defined by a directory with a BUCK file defining default rule/target (the one having the name which is the same as directory name) such that it's:

* Either `java_library` rule with `resource_root` specifying a source/resource folder
* Or it can use `label = ['ide_mod']`, if it's not `java_library` and have no source folders

There can be many rules with `resource_root` defined once module dir is discovered. Mind how rules under same module would or wouldn't have clashes in sources / dependencies.

The most easy and recommended approach to source folders, which stems from how modules are defined and discovered is following:

* `src` directory for compile classes and classpath resources.
* `test` directory for test classes and test resources
* `src-gen`, `test-gen` etc symlinks will be auto-created for annotation processing sources

_Note: it is strongly recommended to stay away from useless and unwieldy Maven directory structure which introduces useless segments (duplicating filename extension roles) and overall brings structure which is not beneficial in any way, yet makes all paths longer, harder to type by hand if ever needed and makes it harder synchronizing parallel package structures._

Example of such module's BUCK files

```python
# //modules/module1/BUCK
java_library(
  name = 'module1', # <- Default target in this directory
  srcs = glob(['src/**/*.java']),
  resources = glob(['src/**'], excludes = ['src/**/*.java']),
  resources_root = 'src', # <- Bingo! we have a module
  deps = [
    '//lib/google/common:common',
  ],
  tests = [':test'],
  visibility = ['PUBLIC'],
)

java_test(
  name = 'test',
  srcs = glob(['test/**/*.java']),
  resources = glob(['test/**']),
  resources_root = 'test', # <- Defines test source folder
  deps = [
    ':module1',
    '//lib/junit:junit',
  ],
)
```

The modules will have references to other modules in case they depend on rules from other modules. Likewise, referenced library jars will be added to a module classpath. Definitely, there's no 1:1 correspondence between Buck rules and IDE modules with regard to granularity and scope of dependencies so expect that more complicated rule arrangements will just not translate correctly to IDE.

* IDE module names will be by default derived from the directory (simple) name where possible. In case of clashes additional (disambiguating) segments will be added to module name.
* In Eclipse, as there are both flat and hierarchical views are available for modules, all modules will be prefixed with the name of the root module.
* Classpath/library files for IDEs will reference jars as symlinks generated in `.out/` directories.
* Provided/exported/test dependency scopes are honored to the degree possible in specific IDE. Eclipse only supports "exported" dependencies.
* Annotation processing will work from Buck build, and IDE will have generated sources attached. Support for in-IDE annotation processing can be added in future.
* In Intellij, in the a module all folders are marked as excluded except the ones which contain modules.
* Can create resource-only `java_library` rule and add `label = ['ide_res']` or `label = ['ide_test_res']` to mark `resources_root` folder as java resources or test resources in Intellij IDEA. These rules still need to be added as dependency to any `java_library` rule which wants to access these resources on the classpath.

_Note: clearly, you can skip using this script and just use `buck project --ide ij` if it suits your needs. We believe Highlands project generation adds some fine touches and may result in better IDE experience._

## Miscellaneous

* Only Java 8, 9, 10, 11, 12, 13 seems to be supported as of now. In `.buckconfig`, use `tools.javac`, `tools.java`, `java.source_level`, `java.target_level` to configure. Buck itself only runs under Java 8, so for 9+ only external compiler/vm should be used.

* This repo is released by tagging, you can use released zip from Github or clone the repo and use/copy from there. Make sure to calculate and verify checksum if in any automatic download script.

* Add `--trace` CLI option every time you're investigating/troubleshooting script execution, this will give nice colored output providing tracing information about shell commands called and files/symlinks created.

<img src="https://raw.githubusercontent.com/immutables/highlands/example/colored-trace.png">

* `--publish` can publish artifacts (libraries having `maven_coords` set), also java binaries via `.fatJar(target)` and zip archives `.zip(folder, options)` declared in `up.js`. It publishes to maven-like repository (configured via `PUBLISH_REPOSITORY`, `PUBLISH_USERNAME`, `PUBLISH_PASSWORD` env variables) or local `.out` folder if no remote repo provided

## Example

This repository also contains branch [example](https://github.com/immutables/highlands/tree/example) which contains full sample Buck project ready to be managed by Highland scripts. It has Java, annotation processor and Kotlin rules used to add some variety.
