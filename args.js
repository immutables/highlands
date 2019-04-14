'use strict'

function validate(options) {
  let validated = {}
  for (let [option, definition] of Object.entries(options)) {
    if (!(Array.isArray(definition)) || definition.length < 2) {
      throw `Option should be defined as '--opt': ['help string', (arg,..) => handle(), 2/*optional order*/], wrong value: ${definition}`
    }
    let [info, handler, order] = definition
    if (typeof info !== 'string') {
      throw `Info string for '${option}' must be defined as function, but was: ${handler}`
    }
    if (typeof handler !== 'function') {
      throw `Handler for '${option}' must be defined as function, but was: ${handler}`
    }
    if (typeof order === 'undefined') {
      // skip as ok
    } else if (typeof order !== 'number' || order < 1) {
      throw `Order value must be a number > 0, but was: ${order}`
    }
    // putting the option token in front
    validated[option] = [option, ...definition]
  }
  return validated
}

function usage(options) {
  let maxOptionLen = Math.max(...Object.keys(options).map(e => e.length))

  let usage = `
Usage: <this-cmd> [<options>]`
  for (let [k, [option, info, handler, _]] of Object.entries(options)) {
    let padding = ' '.repeat(maxOptionLen - option.length)
    usage += `
    ${option}${padding}  ${info}`
  }
  return usage
}

function die(...args) {
  console.error(...args)
  throw process.exit(-127)
}

module.exports = function(options, hooks) {
  options = validate(options)

  let context = {
    usage: () => (console.error(usage(options)), context),
    exit: code => process.exit(code),
  }

  return (args) => {
    let tasks = parse(args)
    try {
      let results = tasks.map(execute)
      if (typeof hooks.end === 'function') {
        hooks.end(tasks, results)
      }
    } catch (e) {
      if (typeof hooks.err === 'function') {
        hooks.err(e)
      } else {
        console.trace(e)
      }
    }
  }

  function execute([[option, info, handler, _], values]) {
    if (typeof hooks.before === 'function') {
      hooks.before(option, info, values)
    }

    let result = handler.apply(context, values)

    if (typeof hooks.after === 'function') {
      hooks.after(option, info, result)
    }
    return result
  }

  function orderOf(task) {
    return task[0][3] || Number.MAX_VALUE
  }

  function taskOrdering(a, b) {
    return orderOf(a) - orderOf(b)
  }

  function parse(args) {
    args = [...args]

    let tasks = []
    while (args.length) {
      let option = args.shift()
      if (!(option in options)) {
        die(`Unsupported option '${option}'`, usage(options))
      }
      let definition = options[option]
      let handler = definition[2]
      let values = []
      for (let i = 0; i < handler.length; i++) {
        let tooFewValues = () => die(`Not enough values for option '${option}' which requires ${handler.length} argument${handler.length > 1 ? 's' : ''}`)
        if (!args.length) tooFewValues()
        let v = args.shift()
        if (v in options) tooFewValues()
        values.push(v)
      }
      tasks.push([definition, values])
    }
    return tasks.sort(taskOrdering)
  }
}
