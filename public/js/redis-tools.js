(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],3:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],4:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],5:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":4,"_process":2,"inherits":3}],6:[function(require,module,exports){
'use strict';
var foldingCharacter = ":";

var CmdParser = require('cmdparser');
window.loadTree = function () {
	$.get('/redis/apiv1/connection', function (isConnected) {
		if (isConnected) {
			$('#keyTree').bind("loaded.jstree", function () {
				var tree = getKeyTree();
				if (tree) {
					var root = tree._get_children(-1)[0];
					tree.open_node(root, null, true);
				}
			});
			getServerInfo(function (data) {
				var json_dataData = [];

				data.forEach(function (instance, index) {
					var host = instance.host;
					var port = instance.port;
					var db = instance.db;
					json_dataData.push({
						data: host + ":" + port + ":" + db,
						state: "closed",
						attr: {
							id: host + ":" + port + ":" + db,
							rel: "root"
						}
					});
					if (index === data.length - 1) {
						return onJSONDataComplete();
					}
				});
				function onJSONDataComplete () {
					$('#keyTree').jstree({
						json_data: {
							data: json_dataData,
							ajax: {
								url: function (node) {
									if (node !== -1) {
										var path = getFullKeyPath(node);
										var root = getRootConnection(node);
										return '/redis/apiv1/keystree/' + encodeURIComponent(root) + '/' + encodeURIComponent(path) + '?absolute=false';
									}
									var root = getRootConnection(node);
									return '/redis/apiv1/keystree/' + encodeURIComponent(root);
								}
							}
						},
						types: {
							types: {
								"root": {
									icon: {
										image: '/img/redis/treeRoot.png'
									}
								},
								"string": {
									icon: {
										image: '/img/redis/treeString.png'
									}
								},
								"hash": {
									icon: {
										image: '/img/redis/treeHash.png'
									}
								},
								"set": {
									icon: {
										image: '/img/redis/treeSet.png'
									}
								},
								"list": {
									icon: {
										image: '/img/redis/treeList.png'
									}
								},
								"zset": {
									icon: {
										image: '/img/redis/treeZSet.png'
									}
								}
							}
						},
						contextmenu: {
							items: function (node) {
								var menu = {
									"addKey": {
										icon: 'icon-plus',
										label: "Add Key",
										action: addKey
									},
									"refresh": {
										icon: 'icon-refresh',
										label: "Refresh",
										action: function (obj) {
											jQuery.jstree._reference("#keyTree").refresh(obj);
										}
									},
									"remKey": {
										icon: 'icon-trash',
										label: 'Remove Key',
										action: deleteKey
									},
									"remConnection": {
										icon: 'icon-trash',
										label: 'Disconnect',
										action: removeServer
									}
								};
								var rel = node.attr('rel');
								if (rel != undefined && rel != 'root') {
									delete menu['addKey'];
								}
								if (rel != 'root') {
									delete menu['remConnection'];
								}
								if (rel == 'root') {
									delete menu['remKey'];
								}
								return menu;
							}
						},
						plugins: [ "themes", "json_data", "types", "ui", "contextmenu" ]
					})
						.bind("select_node.jstree", treeNodeSelected)
						.delegate("a", "click", function (event, data) {
							event.preventDefault();
						});
				}
			});
		} else {
			showAlert('Redis 서버에 연결되어 있지 않습니다');
		}
	});
}

function treeNodeSelected (event, data) {
	$('#body').html('Loading...');

	var pathParts = getKeyTree().get_path(data.rslt.obj, true);
	var path = pathParts.slice(1).join(foldingCharacter);
	var connectionId = pathParts.slice(0, 1)[0];
	if (pathParts.length === 1) {
		var hostAndPort = pathParts[0].split(':');
		$.get('/redis/apiv1/server/info', function (data, status) {
			if (status != 'success') {
				return alert("Could not load server info");
			}
			data = JSON.parse(data);
			data.forEach(function (instance) {
				if (instance.host == hostAndPort[0] && instance.port == hostAndPort[1]) {
					instance.connectionId = connectionId;
					var html = new EJS({ url: '/redis/templates/serverInfo.ejs' }).render(instance);
					$('#body').html(html);
					return setupAddKeyButton();
				}
			});
		});
	} else {
		return loadKey(connectionId, path);
	}
}

function getFullKeyPath (node) {
	return $.jstree._focused().get_path(node, true).slice(1).join(foldingCharacter);
}

function getRootConnection (node) {
	return $.jstree._focused().get_path(node, true).slice(0, 1);
}

function loadKey (connectionId, key, index) {
	if (index) {
		$.get('/redis/apiv1/key/' + encodeURIComponent(connectionId) + "/" + encodeURIComponent(key) + "/" + index, processData);
	} else {
		$.get('/redis/apiv1/key/' + encodeURIComponent(connectionId) + "/" + encodeURIComponent(key), processData);
	}
	function processData (data, status) {
		if (status != 'success') {
			return alert("Could not load key data");
		}

		data = JSON.parse(data);
		data.connectionId = connectionId;
		console.log("rendering type " + data.type);
		switch (data.type) {
			case 'string':
				selectTreeNodeString(data);
				break;
			case 'hash':
				selectTreeNodeHash(data);
				break;
			case 'set':
				selectTreeNodeSet(data);
				break;
			case 'list':
				selectTreeNodeList(data);
				break;
			case 'zset':
				selectTreeNodeZSet(data);
				break;
			case 'none':
				selectTreeNodeBranch(data);
				break;
			default:
				var html = JSON.stringify(data);
				$('#body').html(html);
				break;
		}
		console.log('loadKey processData');
		resizeApp();
	}
}
function selectTreeNodeBranch (data) {
	var html = new EJS({ url: '/redis/templates/editBranch.ejs' }).render(data);
	$('#body').html(html);
}
function setupEditListButton () {
	$('#editListRowForm').ajaxForm({
		beforeSubmit: function () {
			console.log('saving');
			$('#editListValueButton').button('loading');
		},
		error: function (err) {
			console.log('save error', arguments);
			alert("Could not save '" + err.statusText + "'");
			saveComplete();
		},
		success: function () {
			console.log('saved', arguments);
			$('#editListValueButton').button('reset');
			saveComplete();
		}
	});

	function saveComplete () {
		setTimeout(function () {
			refreshTree();
			getKeyTree().select_node(0);
			$('#editListRowModal').modal('hide');
		}, 500);
	}
}

function setupEditZSetButton () {
	$('#editZSetRowForm').ajaxForm({
		beforeSubmit: function () {
			console.log('saving');
			$('#editZSetValueButton').button('loading');
		},
		error: function (err) {
			console.log('save error', arguments);
			alert("Could not save '" + err.statusText + "'");
			saveComplete();
		},
		success: function () {
			console.log('saved', arguments);
			$('#editZSetValueButton').button('reset');
			saveComplete();
		}
	});

	function saveComplete () {
		setTimeout(function () {
			refreshTree();
			getKeyTree().select_node(0);
			$('#editZSetRowModal').modal('hide');
		}, 500);
	}
}

function setupAddKeyButton (connectionId) {
	$('#keyValue').keyup(function () {
		var action = "/redis/apiv1/key/" + encodeURIComponent(connectionId) + "/" + encodeURIComponent($(this).val());
		$('#addKeyForm').attr("action", action);
	});
	$('#keyType').change(function () {
		var score = $('#scoreWrap');
		if ($(this).val() == 'zset') {
			score.show();
		} else {
			score.hide();
		}
	});
	$('#addKeyForm').ajaxForm({
		beforeSubmit: function () {
			console.log('saving');
			$('#saveKeyButton').attr("disabled", "disabled");
			$('#saveKeyButton').html("<i class='icon-refresh'></i> Saving");
		},
		error: function (err) {
			console.log('save error', arguments);
			alert("Could not save '" + err.statusText + "'");
			saveComplete();
		},
		success: function () {
			console.log('saved', arguments);
			saveComplete();
		}
	});

	function saveComplete () {
		setTimeout(function () {
			$('#saveKeyButton').html("Save");
			$('#saveKeyButton').removeAttr("disabled");
			refreshTree();
			$('#addKeyModal').modal('hide');
		}, 500);
	}
}

function setupEditHashButton () {
	$('#editHashFieldForm').ajaxForm({
		beforeSubmit: function () {
			console.log('saving');
			$('#editHashFieldButton').button('loading');
		},
		error: function (err) {
			console.log('save error', arguments);
			alert("Could not save '" + err.statusText + "'");
			saveComplete();
		},
		success: function () {
			console.log('saved', arguments);
			$('#editHashFieldButton').button('reset');
			saveComplete();
		}
	});

	function saveComplete () {
		setTimeout(function () {
			refreshTree();
			getKeyTree().select_node(0);
			$('#editHashRowModal').modal('hide');
		}, 500);
	}
}

function selectTreeNodeString (data) {
	var html = new EJS({ url: '/redis/templates/editString.ejs' }).render(data);
	$('#body').html(html);

	try {
		data.value = JSON.stringify(JSON.parse(data.value), null, '  ');
		$('#isJson').val('true');
	} catch (ex) {
		$('#isJson').val('false');
	}

	$('#stringValue').val(data.value);
	$('#stringValue').keyup(function () {
		$('#stringValueClippy').clippy({'text': $(this).val(), clippy_path: "/redis/clippy-jquery/clippy.swf"});
	}).keyup();
	$('.clippyWrapper').tooltip();
	$('#editStringForm').ajaxForm({
		beforeSubmit: function () {
			console.log('saving');
			$('#saveKeyButton').attr("disabled", "disabled");
			$('#saveKeyButton').html("<i class='icon-refresh'></i> Saving");
		},
		error: function (err) {
			console.log('save error', arguments);
			alert("Could not save '" + err.statusText + "'");
			saveComplete();
		},
		success: function () {
			refreshTree();
			getKeyTree().select_node(0);
			console.log('saved', arguments);
			saveComplete();
		}
	});

	function saveComplete () {
		setTimeout(function () {
			$('#saveKeyButton').html("Save");
			$('#saveKeyButton').removeAttr("disabled");
		}, 500);
	}
}

function selectTreeNodeHash (data) {
	var html = new EJS({ url: '/redis/templates/editHash.ejs' }).render(data);
	$('#body').html(html);
}

function selectTreeNodeSet (data) {
	var html = new EJS({ url: '/redis/templates/editSet.ejs' }).render(data);
	$('#body').html(html);
}

function selectTreeNodeList (data) {
	if (data.items.length > 0) {
		var html = new EJS({ url: '/redis/templates/editList.ejs' }).render(data);
		$('#body').html(html);
		$('#addListValueForm').ajaxForm({
			beforeSubmit: function () {
				console.log('saving');
				$('#saveValueButton').button('loading');
			},
			error: function (err) {
				console.log('save error', arguments);
				alert("Could not save '" + err.statusText + "'");
				saveComplete();
			},
			success: function () {
				console.log('saved', arguments);
				$('#saveValueButton').button('reset');
				saveComplete();
			}
		});
	} else {
		alert('Index out of bounds');
	}
	function saveComplete () {
		setTimeout(function () {
			$('#addListValueModal').modal('hide');
			$('a.jstree-clicked').click();
		}, 500);
	}
}

function selectTreeNodeZSet (data) {
	if (data.items.length > 0) {
		var html = new EJS({ url: '/redis/templates/editZSet.ejs' }).render(data);
		$('#body').html(html);
	} else {
		alert('Index out of bounds');
	}
}

function getKeyTree() {
	return $.jstree._reference('#keyTree');
}

function refreshTree () {
	try {
		getKeyTree().refresh();
	} catch(err) {
		console.log('Key tree refresh error', err);
	}
}

function addKey (connectionId, key) {
	if (typeof(connectionId) == 'object') {
		key = getFullKeyPath(connectionId);
		if (key.length > 0) {
			key = key + ":";
		}
		var pathParts = getKeyTree().get_path(connectionId, true);
		connectionId = pathParts.slice(0, 1)[0];
	}
	$('#addKeyForm').attr('action', '/redis/apiv1/key/' + encodeURIComponent(connectionId) + "/" + encodeURIComponent(key));
	$('#keyValue').val(key);
	$('#addKeyModal').modal('show');
	setupAddKeyButton(connectionId);
}
function deleteKey (connectionId, key) {
	if (typeof(connectionId) == 'object') {
		key = getFullKeyPath(connectionId);
		var pathParts = getKeyTree().get_path(connectionId, true);
		connectionId = pathParts.slice(0, 1)[0];
	}
	var result = confirm('Are you sure you want to delete "' + key + ' from ' + connectionId + '"?');
	if (result) {
		$.post('/redis/apiv1/key/' + encodeURIComponent(connectionId) + '/' + encodeURIComponent(key) + '?action=delete', function (data, status) {
			if (status != 'success') {
				return alert("Could not delete key");
			}

			refreshTree();
			getKeyTree().select_node(-1);
			$('#body').html('');
		});
	}
}


function deleteBranch (connectionId, branchPrefix) {
	var query = branchPrefix + ':*';
	var result = confirm('Are you sure you want to delete "' + query + ' from ' + connectionId + '"? This will delete all children as well!');
	if (result) {
		$.post('/redis/apiv1/keys/' + encodeURIComponent(connectionId) + "/" + encodeURIComponent(query) + '?action=delete', function (data, status) {
			if (status != 'success') {
				return alert("Could not delete branch");
			}

			refreshTree();
			getKeyTree().select_node(-1);
			$('#body').html('');
		});
	}
}
function addListValue (connectionId, key) {
	$('#key').val(key);
	$('#addStringValue').val("");
	$('#addListConnectionId').val(connectionId);
	$('#addListValueModal').modal('show');
}
function editListRow (connectionId, key, index, value) {
	console.log(connectionId);
	$('#editListConnectionId').val(connectionId);
	$('#listKey').val(key);
	$('#listIndex').val(index);
	$('#listValue').val(value);
	$('#editListRowModal').modal('show');
	setupEditListButton();
}
function editZSetRow (connectionId, key, score, value) {
	$('#zSetConnectionId').val(connectionId);
	$('#zSetKey').val(key);
	$('#zSetScore').val(score);
	$('#zSetValue').val(value);
	$('#zSetOldValue').val(value);
	$('#editZSetRowModal').modal('show');
	setupEditZSetButton();
}
function editHashRow (connectionId, key, field, value) {
	$('#hashConnectionId').val(connectionId);
	$('#hashKey').val(key);
	$('#hashField').val(field);
	$('#hashFieldValue').val(value);
	$('#editHashRowModal').modal('show');
	setupEditHashButton();
}
function removeListElement () {
	$('#listValue').val('REDISCOMMANDERTOMBSTONE');
	$('#editListRowForm').submit();
}
function removeZSetElement () {
	$('#zSetValue').val('REDISCOMMANDERTOMBSTONE');
	$('#editZSetRowForm').submit();
}
function removeHashField () {
	$('#hashFieldValue').val('REDISCOMMANDERTOMBSTONE');
	$('#editHashFieldForm').submit();
}

var commandLineScrollTop;
var CLIOpen = false;
function hideCommandLineOutput () {
	var output = $('#commandLineOutput');
	if (output.is(':visible') && $('#lockCommandButton').hasClass('disabled')) {
		output.slideUp(function () {
			resizeApp();
			configChange();
		});
		CLIOpen = false;
		commandLineScrollTop = output.scrollTop() + 20;
		$('#commandLineBorder').removeClass('show-vertical-scroll');
	}
}

function showCommandLineOutput () {
	var output = $('#commandLineOutput');
	if (!output.is(':visible') && $('#lockCommandButton').hasClass('disabled')) {
		output.slideDown(function () {
			output.scrollTop(commandLineScrollTop);
			resizeApp();
			configChange();
		});
		CLIOpen = true;
		$('#commandLineBorder').addClass('show-vertical-scroll');
	}
}

window.loadCommandLine = function () {
	$('#commandLine').click(function () {
		showCommandLineOutput();
	});
	$('#app-container').click(function () {
		hideCommandLineOutput();
	});

	var readline = require("readline-browserify");
	var output = document.getElementById('commandLineOutput');
	var rl = readline.createInterface({
		elementId: 'commandLine',
		write: function (data) {
			if (output.innerHTML.length > 0) {
				output.innerHTML += "<br>";
			}
			output.innerHTML += escapeHtml(data);
			output.scrollTop = output.scrollHeight;
		},
		completer: function (linePartial, callback) {
			cmdparser.completer(linePartial, callback);
		}
	});
	rl.setPrompt('redis> ');
	rl.prompt();
	rl.on('line', function (line) {
		if (output.innerHTML.length > 0) {
			output.innerHTML += "<br>";
		}
		output.innerHTML += "<span class='commandLineCommand'>" + escapeHtml(line) + "</span>";

		line = line.trim();

		if (line.toLowerCase() === 'refresh') {
			rl.prompt();
			refreshTree();
			rl.write("OK");
		} else {
			$.post('/redis/apiv1/exec', { cmd: line, connection: $('#selectedConnection').val() }, function (data, status) {
				rl.prompt();

				if (status != 'success') {
					return alert("Could not delete branch");
				}

				try {
					data = JSON.parse(data);
				} catch (ex) {
					rl.write(data);
					return;
				}
				if (data instanceof Array) {
					for (var i = 0; i < data.length; i++) {
						rl.write((i + 1) + ") " + data[i]);
					}
				} else {
					try {
						data = JSON.parse(data);
					} catch (ex) {
						// do nothing
					}
					rl.write(JSON.stringify(data, null, '  '));
				}
			});
			//refreshTree();
		}
	});
}

function escapeHtml (str) {
	return str
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\n/g, '<br>')
		.replace(/\s/g, '&nbsp;');
}

var cmdparser = new CmdParser([
	"REFRESH",

	"APPEND key value",
	"AUTH password",
	"BGREWRITEAOF",
	"BGSAVE",
	"BITCOUNT key [start] [end]",
	"BITOP operation destkey key [key ...]",
	"BLPOP key [key ...] timeout",
	"BRPOP key [key ...] timeout",
	"BRPOPLPUSH source destination timeout",
	"CONFIG GET parameter",
	"CONFIG SET parameter value",
	"CONFIG RESETSTAT",
	"DBSIZE",
	"DEBUG OBJECT key",
	"DEBUG SEGFAULT",
	"DECR key",
	"DECRBY key decrement",
	"DEL key [key ...]",
	"DISCARD",
	"DUMP key",
	"ECHO message",
	"EVAL script numkeys key [key ...] arg [arg ...]",
	"EVALSHA sha1 numkeys key [key ...] arg [arg ...]",
	"EXEC",
	"EXISTS key",
	"EXPIRE key seconds",
	"EXPIREAT key timestamp",
	"FLUSHALL",
	"FLUSHDB",
	"GET key",
	"GETBIT key offset",
	"GETRANGE key start end",
	"GETSET key value",
	"HDEL key field [field ...]",
	"HEXISTS key field",
	"HGET key field",
	"HGETALL key",
	"HINCRBY key field increment",
	"HINCRBYFLOAT key field increment",
	"HKEYS key",
	"HLEN key",
	"HMGET key field [field ...]",
	"HMSET key field value [field value ...]",
	"HSET key field value",
	"HSETNX key field value",
	"HVALS key",
	"INCR key",
	"INCRBY key increment",
	"INCRBYFLOAT key increment",
	"INFO",
	"KEYS pattern",
	"LASTSAVE",
	"LINDEX key index",
	"LINSERT key BEFORE|AFTER pivot value",
	"LLEN key",
	"LPOP key",
	"LPUSH key value [value ...]",
	"LPUSHX key value",
	"LRANGE key start stop",
	"LREM key count value",
	"LSET key index value",
	"LTRIM key start stop",
	"MGET key [key ...]",
	"MIGRATE host port key destination-db timeout",
	"MONITOR",
	"MOVE key db",
	"MSET key value [key value ...]",
	"MSETNX key value [key value ...]",
	"MULTI",
	"OBJECT subcommand [arguments ...]",
	"PERSIST key",
	"PEXPIRE key milliseconds",
	"PEXPIREAT key milliseconds-timestamp",
	"PING",
	"PSETEX key milliseconds value",
	"PSUBSCRIBE pattern [pattern ...]",
	"PTTL key",
	"PUBLISH channel message",
	"PUNSUBSCRIBE [pattern ...]",
	"QUIT",
	"RANDOMKEY",
	"RENAME key newkey",
	"RENAMENX key newkey",
	"RESTORE key ttl serialized-value",
	"RPOP key",
	"RPOPLPUSH source destination",
	"RPUSH key value [value ...]",
	"RPUSHX key value",
	"SADD key member [member ...]",
	"SAVE",
	"SCARD key",
	"SCRIPT EXISTS script [script ...]",
	"SCRIPT FLUSH",
	"SCRIPT KILL",
	"SCRIPT LOAD script",
	"SDIFF key [key ...]",
	"SDIFFSTORE destination key [key ...]",
	"SELECT index",
	"SET key value",
	"SETBIT key offset value",
	"SETEX key seconds value",
	"SETNX key value",
	"SETRANGE key offset value",
	"SHUTDOWN [NOSAVE|SAVE]",
	"SINTER key [key ...]",
	"SINTERSTORE destination key [key ...]",
	"SISMEMBER key member",
	"SLAVEOF host port",
	"SLOWLOG subcommand [argument]",
	"SMEMBERS key",
	"SMOVE source destination member",
	"SORT key [BY pattern] [LIMIT offset count] [GET pattern [GET pattern ...]] [ASC|DESC] [ALPHA] [STORE destination]",
	"SPOP key",
	"SRANDMEMBER key",
	"SREM key member [member ...]",
	"STRLEN key",
	"SUBSCRIBE channel [channel ...]",
	"SUNION key [key ...]",
	"SUNIONSTORE destination key [key ...]",
	"SYNC",
	"TIME",
	"TTL key",
	"TYPE key",
	"UNSUBSCRIBE [channel ...]",
	"UNWATCH",
	"WATCH key [key ...]",
	"ZADD key score member [score] [member]",
	"ZCARD key",
	"ZCOUNT key min max",
	"ZINCRBY key increment member",
	"ZINTERSTORE destination numkeys key [key ...] [WEIGHTS weight [weight ...]] [AGGREGATE SUM|MIN|MAX]",
	"ZRANGE key start stop [WITHSCORES]",
	"ZRANGEBYSCORE key min max [WITHSCORES] [LIMIT offset count]",
	"ZRANK key member",
	"ZREM key member [member ...]",
	"ZREMRANGEBYRANK key start stop",
	"ZREMRANGEBYSCORE key min max",
	"ZREVRANGE key start stop [WITHSCORES]",
	"ZREVRANGEBYSCORE key max min [WITHSCORES] [LIMIT offset count]",
	"ZREVRANK key member",
	"ZSCORE key member",
	"ZUNIONSTORE destination numkeys key [key ...] [WEIGHTS weight [weight ...]] [AGGREGATE SUM|MIN|MAX]"
], {
	key: function (partial, callback) {
		var redisConnection = $('#selectedConnection').val();
		$.get('/redis/apiv1/keys/' + encodeURIComponent(redisConnection) + "/" + partial + '*?limit=20', function (data, status) {
			if (status != 'success') {
				return callback(new Error("Could not get keys"));
			}
			data = JSON.parse(data)
				.filter(function (item) {
					return item.toLowerCase().indexOf(partial.toLowerCase()) === 0;
				});
			return callback(null, data);
		});
	}
});
var configTimer;
var prevSidebarWidth;
var prevLocked;
var prevCLIWidth;
var prevCLIOpen;
var configLoaded = false;

function getServerInfo (callback) {
	$.get('/redis/apiv1/server/info', function (data, status) {
		callback(JSON.parse(data))
	});
}

function removeServer (connectionId) {
	if (typeof(connectionId) == 'object') {
		var pathParts = getKeyTree().get_path(connectionId, true);
		connectionId = pathParts.slice(0, 1)[0];
	}
	var result = confirm('Are you sure you want to disconnect from "' + connectionId + '"?');
	if (result) {
		$.post('/redis/logout/' + encodeURIComponent(connectionId), function (err, status) {
			if (status != 'success') {
				return alert("Could not remove instance");
			}
			location.reload();
		});
	}
}

function loadDefaultServer (host, port) {
	console.log("host" + host);
	console.log("port" + port);
	$('#hostname').val(host);
	$('#port').val(port);
	$('#addServerForm').submit();
}

function configChange () {
	if (!configLoaded) {
		var sidebarWidth = $('#sideBar').width();
		var locked = !$('#lockCommandButton').hasClass('disabled');
		var CLIWidth = $('#commandLineContainer').height();

		if (typeof(prevSidebarWidth) != 'undefined' &&
			(sidebarWidth != prevSidebarWidth ||
			locked != prevLocked ||
			CLIWidth != prevCLIWidth ||
			CLIOpen != prevCLIOpen)) {
			clearTimeout(configTimer);
			configTimer = setTimeout(saveConfig, 2000);
		}
		prevSidebarWidth = sidebarWidth;
		prevLocked = locked;
		prevCLIWidth = CLIWidth;
		prevCLIOpen = CLIOpen;
	} else {
		configLoaded = false;
	}
}

function saveConfig () {
	var sidebarWidth = $('#sideBar').width();
	var locked = !$('#lockCommandButton').hasClass('disabled');
	var CLIHeight = $('#commandLineContainer').height();
	$.get('/redis/config', function (config) {
		if(config) {
			config["sidebarWidth"] = sidebarWidth;
			config["locked"] = locked;
			config["CLIHeight"] = CLIHeight;
			config["CLIOpen"] = CLIOpen;
			$.post('/redis/config', config, function (data, status) {
			});
		} else {
			var config = {
				"sidebarWidth": sidebarWidth,
				"locked": locked,
				"CLIHeight": CLIHeight,
				"CLIOpen": CLIOpen,
				"default_connections": []
			};
			$.post('/redis/config', config, function (data, status) {
			});
		}
	});
}
window.loadConfig = function (callback) {
	$.get('/redis/config', function (data) {
		if (data) {
			if (data['sidebarWidth']) {
				$('#sideBar').width(data['sidebarWidth']);
			}
			if (data['CLIOpen'] == "true") {
				$('#commandLineOutput').slideDown(0, function () {
					if (data['CLIHeight']) {
						$('#commandLineOutput').height(data['CLIHeight']);
					}
				});
				CLIOpen = true;
			}
			if (data['locked'] == "true") {
				$('#lockCommandButton').removeClass('disabled');
			} else {
				$('#lockCommandButton').addClass('disabled');
			}
			configLoaded = true;
			if (callback) {
				callback();
			}
		}
	});
}
function resizeApp () {
	var barWidth = $('#keyTree').outerWidth(true);
	//$('#sideBar').css('width', barWidth);
	var bodyMargin = parseInt($('#body').css('margin-left'), 10);
	var newBodyWidth = $(window).width() - barWidth - bodyMargin;
	$('#body, #itemActionsBar').css('width', newBodyWidth);
	$('#body, #itemActionsBar').css('left', barWidth);

	//console.log('barWidth:'+barWidth+', bodyMargin:'+bodyMargin+', newBodyWidth:'+newBodyWidth);

	var height = $(window).height() - $('#keyTree').offset().top - $('#commandLineContainer').outerHeight(true);
	$('#keyTree').height(height);
	$('#itemData').height(height - $('#itemActionsBar').outerHeight(true) + 82);
	$('#body, #sidebarResize').css('height', $('#sideBar').css('height'));
	configChange();
}
window.setupResizeEvents = function () {
	var sidebarResizing = false;
	var sidebarFrame = $("#sideBar").width();
	var commandResizing = false;
	var commandFrame = $('#commandLineOutput').height();

	$('#keyTree').bind('resize', resizeApp);
	$(window).bind('resize', resizeApp);

	$(document).mouseup(function (event) {
		sidebarResizing = false;
		sidebarFrame = $("#sideBar").width();
		commandResizing = false;
		commandFrame = $('#commandLineOutput').height();
		$('body').removeClass('select-disabled');
	});

	$("#sidebarResize").mousedown(function (event) {
		sidebarResizing = event.pageX;
		$('body').addClass('select-disabled');
	});

	$("#commandLineBorder").mousedown(function (event) {
		commandResizing = event.pageY;
		$('body').addClass('select-disabled');
	});

	$(document).mousemove(function (event) {
		if (sidebarResizing) {
			var w = sidebarFrame - (sidebarResizing - event.pageX);
			if(w > 240) {
				$("#sideBar").width(w);
				resizeApp();
			}
		} else if (commandResizing &&
			$('#commandLineOutput').is(':visible')) {
			$("#commandLineOutput").height(commandFrame + (commandResizing - event.pageY));
			resizeApp();
		}
	});
}

window.setupCommandLock = function () {
	$('#lockCommandButton').click(function () {
		$(this).toggleClass('disabled');
		configChange();
	});
}

window.setupCLIKeyEvents = function () {
	var ctrl_down = false;
	var isMac = navigator.appVersion.indexOf("Mac") != -1;
	var cli = $('#_readline_cliForm input');
	cli.on('keydown', function (e) {
		var key = e.which;
		//ctrl
		if (key == 17 && isMac) {
			ctrl_down = true;
		}

		//c
		if (key == 67 && ctrl_down) {
			clearCLI();
			e.preventDefault();
		}

		//esc
		if (key == 27) {
			clearCLI();
			e.preventDefault();
		}
	});
	cli.on('keyup', function (e) {
		var key = e.which;
		//ctrl
		if (key == 17 && isMac) {
			ctrl_down = false;
		}
	});

	function clearCLI () {
		var cli = $('#_readline_cliForm input');
		if (cli.val() == '') {
			hideCommandLineOutput();
		} else {
			cli.val('');
		}
	}
}

},{"cmdparser":9,"readline-browserify":10}],7:[function(require,module,exports){
// This file is just added for convenience so this repository can be
// directly checked out into a project's deps folder
module.exports = require('./lib/async');

},{"./lib/async":8}],8:[function(require,module,exports){
(function (process){
/*global setTimeout: false, console: false */
(function () {

    var async = {};

    // global on the server, window in the browser
    var root = this,
        previous_async = root.async;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = async;
    }
    else {
        root.async = async;
    }

    async.noConflict = function () {
        root.async = previous_async;
        return async;
    };

    //// cross-browser compatiblity functions ////

    var _forEach = function (arr, iterator) {
        if (arr.forEach) {
            return arr.forEach(iterator);
        }
        for (var i = 0; i < arr.length; i += 1) {
            iterator(arr[i], i, arr);
        }
    };

    var _map = function (arr, iterator) {
        if (arr.map) {
            return arr.map(iterator);
        }
        var results = [];
        _forEach(arr, function (x, i, a) {
            results.push(iterator(x, i, a));
        });
        return results;
    };

    var _reduce = function (arr, iterator, memo) {
        if (arr.reduce) {
            return arr.reduce(iterator, memo);
        }
        _forEach(arr, function (x, i, a) {
            memo = iterator(memo, x, i, a);
        });
        return memo;
    };

    var _keys = function (obj) {
        if (Object.keys) {
            return Object.keys(obj);
        }
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        return keys;
    };

    //// exported async module functions ////

    //// nextTick implementation with browser-compatible fallback ////
    if (typeof process === 'undefined' || !(process.nextTick)) {
        async.nextTick = function (fn) {
            setTimeout(fn, 0);
        };
    }
    else {
        async.nextTick = process.nextTick;
    }

    async.forEach = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        _forEach(arr, function (x) {
            iterator(x, function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed === arr.length) {
                        callback(null);
                    }
                }
            });
        });
    };

    async.forEachSeries = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed === arr.length) {
                        callback(null);
                    }
                    else {
                        iterate();
                    }
                }
            });
        };
        iterate();
    };

    async.forEachLimit = function (arr, limit, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length || limit <= 0) {
            return callback();
        }
        var completed = 0;
        var started = 0;
        var running = 0;

        (function replenish () {
            if (completed === arr.length) {
                return callback();
            }

            while (running < limit && started < arr.length) {
                started += 1;
                running += 1;
                iterator(arr[started - 1], function (err) {
                    if (err) {
                        callback(err);
                        callback = function () {};
                    }
                    else {
                        completed += 1;
                        running -= 1;
                        if (completed === arr.length) {
                            callback();
                        }
                        else {
                            replenish();
                        }
                    }
                });
            }
        })();
    };


    var doParallel = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.forEach].concat(args));
        };
    };
    var doSeries = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.forEachSeries].concat(args));
        };
    };


    var _asyncMap = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (err, v) {
                results[x.index] = v;
                callback(err);
            });
        }, function (err) {
            callback(err, results);
        });
    };
    async.map = doParallel(_asyncMap);
    async.mapSeries = doSeries(_asyncMap);


    // reduce only has a series version, as doing reduce in parallel won't
    // work in many situations.
    async.reduce = function (arr, memo, iterator, callback) {
        async.forEachSeries(arr, function (x, callback) {
            iterator(memo, x, function (err, v) {
                memo = v;
                callback(err);
            });
        }, function (err) {
            callback(err, memo);
        });
    };
    // inject alias
    async.inject = async.reduce;
    // foldl alias
    async.foldl = async.reduce;

    async.reduceRight = function (arr, memo, iterator, callback) {
        var reversed = _map(arr, function (x) {
            return x;
        }).reverse();
        async.reduce(reversed, memo, iterator, callback);
    };
    // foldr alias
    async.foldr = async.reduceRight;

    var _filter = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.filter = doParallel(_filter);
    async.filterSeries = doSeries(_filter);
    // select alias
    async.select = async.filter;
    async.selectSeries = async.filterSeries;

    var _reject = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (!v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.reject = doParallel(_reject);
    async.rejectSeries = doSeries(_reject);

    var _detect = function (eachfn, arr, iterator, main_callback) {
        eachfn(arr, function (x, callback) {
            iterator(x, function (result) {
                if (result) {
                    main_callback(x);
                    main_callback = function () {};
                }
                else {
                    callback();
                }
            });
        }, function (err) {
            main_callback();
        });
    };
    async.detect = doParallel(_detect);
    async.detectSeries = doSeries(_detect);

    async.some = function (arr, iterator, main_callback) {
        async.forEach(arr, function (x, callback) {
            iterator(x, function (v) {
                if (v) {
                    main_callback(true);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(false);
        });
    };
    // any alias
    async.any = async.some;

    async.every = function (arr, iterator, main_callback) {
        async.forEach(arr, function (x, callback) {
            iterator(x, function (v) {
                if (!v) {
                    main_callback(false);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(true);
        });
    };
    // all alias
    async.all = async.every;

    async.sortBy = function (arr, iterator, callback) {
        async.map(arr, function (x, callback) {
            iterator(x, function (err, criteria) {
                if (err) {
                    callback(err);
                }
                else {
                    callback(null, {value: x, criteria: criteria});
                }
            });
        }, function (err, results) {
            if (err) {
                return callback(err);
            }
            else {
                var fn = function (left, right) {
                    var a = left.criteria, b = right.criteria;
                    return a < b ? -1 : a > b ? 1 : 0;
                };
                callback(null, _map(results.sort(fn), function (x) {
                    return x.value;
                }));
            }
        });
    };

    async.auto = function (tasks, callback) {
        callback = callback || function () {};
        var keys = _keys(tasks);
        if (!keys.length) {
            return callback(null);
        }

        var results = {};

        var listeners = [];
        var addListener = function (fn) {
            listeners.unshift(fn);
        };
        var removeListener = function (fn) {
            for (var i = 0; i < listeners.length; i += 1) {
                if (listeners[i] === fn) {
                    listeners.splice(i, 1);
                    return;
                }
            }
        };
        var taskComplete = function () {
            _forEach(listeners.slice(0), function (fn) {
                fn();
            });
        };

        addListener(function () {
            if (_keys(results).length === keys.length) {
                callback(null, results);
                callback = function () {};
            }
        });

        _forEach(keys, function (k) {
            var task = (tasks[k] instanceof Function) ? [tasks[k]]: tasks[k];
            var taskCallback = function (err) {
                if (err) {
                    callback(err);
                    // stop subsequent errors hitting callback multiple times
                    callback = function () {};
                }
                else {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    taskComplete();
                }
            };
            var requires = task.slice(0, Math.abs(task.length - 1)) || [];
            var ready = function () {
                return _reduce(requires, function (a, x) {
                    return (a && results.hasOwnProperty(x));
                }, true) && !results.hasOwnProperty(k);
            };
            if (ready()) {
                task[task.length - 1](taskCallback, results);
            }
            else {
                var listener = function () {
                    if (ready()) {
                        removeListener(listener);
                        task[task.length - 1](taskCallback, results);
                    }
                };
                addListener(listener);
            }
        });
    };

    async.waterfall = function (tasks, callback) {
        callback = callback || function () {};
        if (!tasks.length) {
            return callback();
        }
        var wrapIterator = function (iterator) {
            return function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    var args = Array.prototype.slice.call(arguments, 1);
                    var next = iterator.next();
                    if (next) {
                        args.push(wrapIterator(next));
                    }
                    else {
                        args.push(callback);
                    }
                    async.nextTick(function () {
                        iterator.apply(null, args);
                    });
                }
            };
        };
        wrapIterator(async.iterator(tasks))();
    };

    async.parallel = function (tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor === Array) {
            async.map(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            async.forEach(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.series = function (tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor === Array) {
            async.mapSeries(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            async.forEachSeries(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.iterator = function (tasks) {
        var makeCallback = function (index) {
            var fn = function () {
                if (tasks.length) {
                    tasks[index].apply(null, arguments);
                }
                return fn.next();
            };
            fn.next = function () {
                return (index < tasks.length - 1) ? makeCallback(index + 1): null;
            };
            return fn;
        };
        return makeCallback(0);
    };

    async.apply = function (fn) {
        var args = Array.prototype.slice.call(arguments, 1);
        return function () {
            return fn.apply(
                null, args.concat(Array.prototype.slice.call(arguments))
            );
        };
    };

    var _concat = function (eachfn, arr, fn, callback) {
        var r = [];
        eachfn(arr, function (x, cb) {
            fn(x, function (err, y) {
                r = r.concat(y || []);
                cb(err);
            });
        }, function (err) {
            callback(err, r);
        });
    };
    async.concat = doParallel(_concat);
    async.concatSeries = doSeries(_concat);

    async.whilst = function (test, iterator, callback) {
        if (test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.whilst(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.until = function (test, iterator, callback) {
        if (!test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.until(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.queue = function (worker, concurrency) {
        var workers = 0;
        var q = {
            tasks: [],
            concurrency: concurrency,
            saturated: null,
            empty: null,
            drain: null,
            push: function (data, callback) {
                if(data.constructor !== Array) {
                    data = [data];
                }
                _forEach(data, function(task) {
                    q.tasks.push({
                        data: task,
                        callback: typeof callback === 'function' ? callback : null
                    });
                    if (q.saturated && q.tasks.length == concurrency) {
                        q.saturated();
                    }
                    async.nextTick(q.process);
                });
            },
            process: function () {
                if (workers < q.concurrency && q.tasks.length) {
                    var task = q.tasks.shift();
                    if(q.empty && q.tasks.length == 0) q.empty();
                    workers += 1;
                    worker(task.data, function () {
                        workers -= 1;
                        if (task.callback) {
                            task.callback.apply(task, arguments);
                        }
                        if(q.drain && q.tasks.length + workers == 0) q.drain();
                        q.process();
                    });
                }
            },
            length: function () {
                return q.tasks.length;
            },
            running: function () {
                return workers;
            }
        };
        return q;
    };

    var _console_fn = function (name) {
        return function (fn) {
            var args = Array.prototype.slice.call(arguments, 1);
            fn.apply(null, args.concat([function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (typeof console !== 'undefined') {
                    if (err) {
                        if (console.error) {
                            console.error(err);
                        }
                    }
                    else if (console[name]) {
                        _forEach(args, function (x) {
                            console[name](x);
                        });
                    }
                }
            }]));
        };
    };
    async.log = _console_fn('log');
    async.dir = _console_fn('dir');
    /*async.info = _console_fn('info');
    async.warn = _console_fn('warn');
    async.error = _console_fn('error');*/

    async.memoize = function (fn, hasher) {
        var memo = {};
        var queues = {};
        hasher = hasher || function (x) {
            return x;
        };
        var memoized = function () {
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            var key = hasher.apply(null, args);
            if (key in memo) {
                callback.apply(null, memo[key]);
            }
            else if (key in queues) {
                queues[key].push(callback);
            }
            else {
                queues[key] = [callback];
                fn.apply(null, args.concat([function () {
                    memo[key] = arguments;
                    var q = queues[key];
                    delete queues[key];
                    for (var i = 0, l = q.length; i < l; i++) {
                      q[i].apply(null, arguments);
                    }
                }]));
            }
        };
        memoized.unmemoized = fn;
        return memoized;
    };

    async.unmemoize = function (fn) {
      return function () {
        return (fn.unmemoized || fn).apply(null, arguments);
      };
    };

}());

}).call(this,require('_process'))
},{"_process":2}],9:[function(require,module,exports){
'use strict';

var async = require('async');

var COMPLETING_ERROR = 'completeing';

var CmdParser = module.exports = function (commands, completers) {
  this._commands = commands.map(parseCommand);
  this._completers = completers;
};

CmdParser.prototype.parse = function (str, callback) {
  var matches = [];
  async.forEach(this._commands, function (cmd, cb) {
    cmd.parse(str, function (err, r) {
      if (r) {
        matches.push(r);
      }
      cb();
    });
  }, function (err) {
    if (err) {
      return callback(err);
    }
    if (matches.length === 0) {
      return callback();
    }
    if (matches.length === 1) {
      return callback(null, matches[0]);
    }
    return callback(new Error('Multiple matches [' + JSON.stringify(matches) + '] for string "' + str + '".'));
  });
};

CmdParser.prototype.completer = function (str, callback) {
  var self = this;
  var matches = [];
  async.forEach(this._commands, function (cmd, cb) {
    cmd.completer(str, self._completers, function (err, r) {
      if (r) {
        matches.push(r);
      }
      cb();
    });
  }, function (err) {
    if (err) {
      return callback(err);
    }
    if (matches.length === 0) {
      return callback();
    }
    var bestPartial = matches[0].partial; // todo find a better way
    var results = [
      [],
      bestPartial
    ];
    matches.forEach(function (m) {
      if (m.partial.toLowerCase() === bestPartial.toLowerCase()) {
        if (m.value instanceof Array) {
          results[0] = results[0].concat(m.value);
        } else {
          results[0].push(m.value);
        }
      }
    });
    callback(null, results);
  });
};

function parseCommand(cmd) {
  var debug = false;

  var m = cmd.match(/^(.*?)\s(.*)/);
  var commandName;
  var parts = [];
  var paramName;
  var i;
  if (m) {
    commandName = m[1];
    parts.push({ op: 'commandName', name: commandName });
    var cmdParameters = m[2];
    for (i = 0; i < cmdParameters.length;) {
      if (cmdParameters[i] === '[') {
        i++;
        paramName = '';
        while (cmdParameters[i] !== ']') {
          paramName += cmdParameters[i++];
        }
        i++;

        var subParts = paramName.split(' ');
        var repeat = false;
        if (subParts[subParts.length - 1] === '...') {
          repeat = true;
          subParts.splice(subParts.length - 1);
        }

        subParts = subParts.map(function (name) {
          if (name.toUpperCase() === name) {
            return {
              op: 'literal',
              names: name.split('|')
            };
          }

          return {
            op: 'requiredParameter',
            name: name
          };
        });
        parts.push({
          repeat: repeat,
          op: 'optionalParameters',
          parts: subParts
        });
        continue;
      }

      if (isWhitespace(cmdParameters[i])) {
        i++;
        continue;
      }

      paramName = '';
      while (i < cmdParameters.length && !isWhitespace(cmdParameters[i])) {
        paramName += cmdParameters[i++];
      }
      if (paramName.toUpperCase() === paramName) {
        parts.push({
          op: 'literal',
          names: paramName.split('|')
        });
      } else {
        parts.push({
          op: 'requiredParameter',
          name: paramName
        });
      }
    }
  } else {
    commandName = cmd;
    parts.push({ op: 'commandName', name: commandName });
  }

  for (i = 0; i < parts.length; i++) {
    if (parts[i].op === 'optionalParameters' && parts[i].parts[0].op === 'literal') {
      var startOrPartIdx = i;
      var endOrPartIdx = i;
      while (endOrPartIdx < parts.length && parts[endOrPartIdx].op === 'optionalParameters' && parts[endOrPartIdx].parts[0].op === 'literal') {
        endOrPartIdx++;
      }
      if (startOrPartIdx !== endOrPartIdx - 1) {
        var orPart = {
          op: 'optionalParameterLiteralOr',
          parts: parts.slice(startOrPartIdx, endOrPartIdx)
        };
        parts.splice(startOrPartIdx, endOrPartIdx - startOrPartIdx, orPart);
        i = startOrPartIdx - 1;
      }
    }
  }

  function doParse(str, callback) {
    var state = {
      parsing: true,
      strIdx: 0,
      startStrIdx: 0,
      str: str,
      cmd: cmd,
      debug: debug,
      result: {
        name: null,
        params: {}
      }
    };
    parseAll(state, parts, callback);
  }

  function doCompleter(str, completers, callback) {
    var state = {
      completing: true,
      completers: completers,
      strIdx: 0,
      startStrIdx: 0,
      str: str,
      cmd: cmd,
      debug: debug,
      result: {
        name: null,
        params: {}
      }
    };
    parseAll(state, parts, function (err) {
      callback(err, state.completer);
    });
  }

  return {
    parse: doParse,
    completer: doCompleter
  };
}

function isWhitespace(ch) {
  return /\s/.test(ch)
}

function skipWhitespace(state) {
  var startStrIdx = state.strIdx;
  while (state.strIdx < state.str.length && isWhitespace(state.str[state.strIdx])) {
    state.strIdx++;
  }
  return state.strIdx !== startStrIdx;
}

function readNextWord(state) {
  var word = '';
  if (state.str[state.strIdx] === '"') {
    state.strIdx++;
    while (state.strIdx < state.str.length && state.str[state.strIdx] !== '"') {
      if (state.str[state.strIdx] === '\\') {
        state.strIdx++;
        word += state.str[state.strIdx++];
      } else {
        word += state.str[state.strIdx++];
      }
    }
    state.strIdx++;
  } else {
    while (state.strIdx < state.str.length && !isWhitespace(state.str[state.strIdx])) {
      word += state.str[state.strIdx++];
    }
  }
  return word;
}

function peekNextWord(state) {
  var saveStrIdx = state.strIdx;
  var word = readNextWord(state);
  state.strIdx = saveStrIdx;
  return word;
}

function isEndOfString(state) {
  return state.str.length === state.strIdx;
}

function parseAll(state, parts, callback) {
  if (state.debug) {
    console.log('parts', state.cmd, JSON.stringify(parts, null, '  '));
  }

  async.forEachSeries(parts, function (part, callback) {
    if (state.completer) {
      return callback();
    }

    if (part.op === 'commandName') {
      return parseCommandName(state, part, callback);
    }

    if (part.op === 'requiredParameter') {
      return parseRequiredParameter(state, part, callback);
    }

    if (part.op === 'optionalParameters') {
      return parseOptionalParameters(state, part, callback);
    }

    if (part.op === 'literal') {
      return parseLiteral(state, part, callback);
    }

    if (part.op === 'optionalParameterLiteralOr') {
      return parseOptionalParameterLiteralOr(state, part, callback);
    }

    return callback(new Error("could not parse: " + JSON.stringify(state)));
  }, function (err) {
    if (err) {
      return callback(err);
    }
    if (state.debug) {
      console.log('parseAll ok', JSON.stringify(state, null, '  '));
    }
    return callback(null, state.result);
  });
}

function parseRequiredParameter(state, part, callback) {
  if (state.debug) {
    console.log('parseRequiredParameter', state, part);
  }
  var val = readNextWord(state);
  if (val.length === 0 && !state.completing) {
    return callback(null, false);
  }

  state.result.params[part.name] = val;
  var endsInSpace = skipWhitespace(state);

  if (!endsInSpace && state.completers && state.completers[part.name]) {
    state.completers[part.name](val, function (err, values) {
      if (err) {
        return callback(err);
      }
      state.completer = {
        partial: val,
        value: values
      };
      return callback(null, true);
    });
  } else {
    return callback(null, true);
  }
}

function parseCommandName(state, part, callback) {
  if (state.debug) {
    console.log('parseCommandName', state, part);
  }
  var word = readNextWord(state);
  if (word.toLowerCase() !== part.name.toLowerCase()) {
    if (part.name.toLowerCase().indexOf(word.toLowerCase()) === 0 && isEndOfString(state)) {
      state.completer = {
        partial: word,
        value: part.name + ' '
      };
    }
    if (state.parsing) {
      return callback(new Error("Command name does not match. expected: " + part.name + ", found: " + word));
    } else {
      return callback(COMPLETING_ERROR);
    }
  }
  state.result.name = part.name;
  skipWhitespace(state);
  return callback();
}

function parseOptionalParameters(state, part, callback) {
  if (state.debug) {
    console.log('parseOptionalParameters', state, part);
  }
  if (part.repeat) {
    var saveResults = state.result;
    state.result = {params: {}};
    async.whilst(
      function () { return !isEndOfString(state); },
      function (cb) {
        parseAll(state, part.parts, function (err) {
          if (state.debug) {
            console.log('repeat', state);
          }
          mergeResultsAsArrays(saveResults, state.result);
          cb();
        });
      }, function (err) {
        state.result = saveResults;
        if (err) {
          return callback(err);
        }
        callback();
      }
    );
  } else {
    parseAll(state, part.parts, callback);
  }
}

function parseLiteral(state, part, callback) {
  if (state.debug) {
    console.log('parseLiteral', state, part);
  }

  var i;
  for (i = 0; i < part.names.length; i++) {
    state.result.params[part.names[i]] = false;
  }

  var word = readNextWord(state);
  if (!word) {
    state.completer = {
      partial: word,
      value: part.names
    };

    part.names.forEach(function (name) {
      state.result.params[name] = false;
    });
    return callback(new Error("No values left in string"));
  }

  for (i = 0; i < part.names.length; i++) {
    if (word.toLowerCase() === part.names[i].toLowerCase()) {
      state.result.params[part.names[i]] = true;
      skipWhitespace(state);
      return callback();
    }
  }

  if (isEndOfString(state)) {
    var matches = [];
    for (i = 0; i < part.names.length; i++) {
      if (part.names[i].toLowerCase().indexOf(word.toLowerCase()) === 0) {
        matches.push(part.names[i]);
      }
    }

    if (matches.length > 0) {
      state.completer = {
        partial: word,
        value: matches
      };
    }
  }
  if (state.parsing) {
    return callback(new Error("Partial match"));
  } else {
    return callback(COMPLETING_ERROR);
  }
}

function parseOptionalParameterLiteralOr(state, part, callback) {
  if (state.debug) {
    console.log('parseOptionalParameterLiteralOr', state, part);
  }
  var word = peekNextWord(state);
  var match = null;
  for (var i = 0; i < part.parts.length; i++) {
    for (var n = 0; n < part.parts[i].parts[0].names.length; n++) {
      var literalValue = part.parts[i].parts[0].names[n];
      if (literalValue.toLowerCase() === word.toLowerCase()) {
        match = part.parts[i];
      } else {
        state.result.params[literalValue] = false;
      }
    }
  }

  if (match) {
    if (state.debug) {
      console.log('parseOptionalParameterLiteralOr match', part.parts[i]);
    }
    return parseAll(state, match.parts, callback)
  } else {
    return callback(new Error("No matches found"));
  }
}

function mergeResultsAsArrays(dest, src) {
  for (var key in src.params) {
    var val = src.params[key];
    if (dest.params[key] instanceof Array) {
      dest.params[key].push(val);
    } else if (dest.params[key]) {
      dest.params[key] = [dest.params[key], val];
    } else {
      dest.params[key] = [val];
    }
  }
}
},{"async":7}],10:[function(require,module,exports){
'use strict';

var util = require("util");
var events = require("events");

var lastMatches = null;
var shiftMode = false;

exports.createInterface = function (options) {
  return new ReadLineInterface(options);
};

function ReadLineInterface(options) {
  this.history = [];
  this._historyIdx = this.history.length;
  this._currentInput = '';
  this._options = options;
  this._options.maxAutoComplete = 20;
  this._options.startIndex = 0;
  this._options.write = this._options.write || console.log;
  this._elem = document.getElementById(this._options.elementId);
}
util.inherits(ReadLineInterface, events.EventEmitter);

ReadLineInterface.prototype.setPrompt = function (prompt) {
  this._prompt = prompt;
};

ReadLineInterface.prototype.prompt = function (preserveCursor) {
  this._elem.innerHTML =
  '<form id="_readline_cliForm">'
    + '<span class="prompt">' + this._prompt + '</span>'
    + '<input id="_readline_input" autocomplete="off" spellcheck="false" type="text">'
    + '<div class="autocompletePopup" id="_readline_autocomplete" style="display: none; position: fixed;"></div>'
    + '</form>';

  var form = document.getElementById('_readline_cliForm');
  addEvent(form, 'submit', this._onSubmit.bind(this));

  var input = document.getElementById('_readline_input');
  addEvent(input, 'keydown', this._inputKeydown.bind(this));
  addEvent(input, 'keyup', this._inputKeyup.bind(this));
  input.focus();
};

ReadLineInterface.prototype._inputKeydown = function (e) {
  var SHIFT = 16;
  var TABKEY = 9;
  var UP = 38;
  var DOWN = 40;
  var ENTER = 13;
  var idx, count, value;
  var self = this;
  var input = document.getElementById('_readline_input');

  if (e.keyCode === ENTER) {
    value = this.getAutoCompleteValue();
    if (value) {
      if (value === "more"){
        this._showAutoComplete(input, lastMatches, ++this._options.startIndex);
      } else if (value === "prev"){
        this._showAutoComplete(input, lastMatches, --this._options.startIndex);
      } else{
        this._updateValueWithCompletion(input, this.lastLinePartial, value);
        this._hideAutoComplete();
        this._options.startIndex = 0;
      }
        return preventDefault(e);
    }
  }
  else if (e.keyCode === TABKEY) {
    if (this._isAutoCompleteVisible()) {
      value = this.getAutoCompleteValue();
      if (value) {
        if (value === "more"){
        this._showAutoComplete(input, lastMatches, ++this._options.startIndex);
        } else if (value === "prev"){
        this._showAutoComplete(input, lastMatches, --this._options.startIndex);
        } else{
          this._updateValueWithCompletion(input, this.lastLinePartial, value);
          this._hideAutoComplete();
          this._options.startIndex = 0;
        }
      } else{
        if (shiftMode){
          this._showAutoComplete(input, lastMatches, --this._options.startIndex);
        } else{
          this._showAutoComplete(input, lastMatches, ++this._options.startIndex);
        }
      }
    } else {
      if (this._options.completer) {
        self._showWaitForCompleter(input);
        this._options.completer(input.value, function (err, matchArray) {
          if (!matchArray) {
            self._hideAutoComplete();
            return;
          }
          var matches = matchArray[0];
          lastMatches = matches;
          self.lastLinePartial = matchArray[1];
          if (matches.length === 0) {
            self._hideAutoComplete();
          }
          else if (matches.length === 1) {
            self._updateValueWithCompletion(input, self.lastLinePartial, matches[0]);
            self._hideAutoComplete();
          } else if (matches.length > 1) {
            self._showAutoComplete(input, matches);
          }
        });
      }
    }
    return preventDefault(e);
  } else if (e.keyCode == DOWN) {
    count = this.getAutoCompleteCount();
    if (count === 0) {
      if (this._historyIdx <= this.history.length - 1) {
        this._historyIdx++;
        if (this._historyIdx >= this.history.length) {
          input.value = this._currentInput;
        } else {
          input.value = this.history[this._historyIdx];
        }
      }
    } else {
      idx = this.getSelectedAutoCompleteItemIndex() + 1;
      if (idx >= count) {
        idx = 0;
      }
      this.setSelectedAutoCompleteItemIndex(idx);
    }
    return preventDefault(e);
  } else if (e.keyCode == UP) {
    count = this.getAutoCompleteCount();
    if (count === 0) {
      if (this._historyIdx === this.history.length) {
        this._currentInput = input.value;
      }
      if (this._historyIdx >= 1) {
        this._historyIdx--;
        input.value = this.history[this._historyIdx];
      }
    } else {
      idx = this.getSelectedAutoCompleteItemIndex() - 1;
      if (idx < 0) {
        idx = count - 1;
      }
      this.setSelectedAutoCompleteItemIndex(idx);
    }
    return preventDefault(e);
  } else if (e.keyCode == SHIFT){
    shiftMode = true;
  } else {
    this._hideAutoComplete();
    this._options.startIndex = 0;
  }
  return true;
};

ReadLineInterface.prototype._inputKeyup = function (e) {
  var SHIFT = 16;
  if (e.keyCode == SHIFT){
    shiftMode = false;
  }
}

ReadLineInterface.prototype._updateValueWithCompletion = function (input, linePartial, value) {
  input.value = input.value.replace(new RegExp(linePartial + '$'), value);
};

ReadLineInterface.prototype._isAutoCompleteVisible = function () {
  var autocomplete = document.getElementById('_readline_autocomplete');
  return autocomplete.style.display !== 'none';
};

ReadLineInterface.prototype._hideAutoComplete = function () {
  var autocomplete = document.getElementById('_readline_autocomplete');
  autocomplete.innerHTML = '';
  autocomplete.style.display = 'none';
};

ReadLineInterface.prototype._autoCompleteClick = function (elem) {
  var input = document.getElementById('_readline_input');
  var value = elem.getAttribute('data-value');
  if (value === "more"){
    this._showAutoComplete(input, lastMatches, ++this._options.startIndex);
  } else if (value === "prev"){
    this._showAutoComplete(input, lastMatches, --this._options.startIndex);
  } else{
    this._updateValueWithCompletion(input, this.lastLinePartial, value);
    this._hideAutoComplete();
    this._options.startIndex = 0;
  }
  input.focus();
};

ReadLineInterface.prototype._getAutoCompleteElement = function () {
  return document.getElementById('_readline_autocomplete');
};

ReadLineInterface.prototype._showWaitForCompleter = function (input) {
  var autocomplete = this._getAutoCompleteElement();
  autocomplete.innerHTML = "<div>Loading...</div>";
  this._positionAutoComplete(input);
};

ReadLineInterface.prototype._showAutoComplete = function (input, matches, startIndex) {
  console.log(startIndex);
  if (!startIndex || startIndex <0)
  {
    startIndex = 0;
    this._options.startIndex = startIndex;
  } else{
    startIndex = startIndex * this._options.maxAutoComplete;
  }
  var maxAutoComplete = false;
  if (matches.length > this._options.maxAutoComplete + startIndex) {
    matches = matches.slice(startIndex, startIndex + this._options.maxAutoComplete);
    maxAutoComplete = true;
  } else if (startIndex > 0){
    matches = matches.slice(startIndex);
  }
  if (matches.length === 0 && startIndex != 0){
      this._options.startIndex =-1;
  }
  var autocomplete = this._getAutoCompleteElement();
  autocomplete.style.display = 'none';
  var html = '';
  matches.forEach(function (match) {
    html += '<div data-value="' + match + '">' + match + "</div>";
  });
  if (maxAutoComplete) {
    html += '<div data-value="more">more...</div>';
  }
  if (startIndex > 0 && matches.length != 0) {
    html += '<div data-value="prev">prev...</div>';
  }
  autocomplete.innerHTML = html;
  for (var i = 0; i < autocomplete.children.length; i++) {
    var child = autocomplete.children[i];
    addEvent(child, 'click', this._autoCompleteClick.bind(this, child));
  }
  this._positionAutoComplete(input);
};

ReadLineInterface.prototype._positionAutoComplete = function (input) {
  var autocomplete = this._getAutoCompleteElement();
  var inputLoc = getOffset(input);
  autocomplete.style.left = inputLoc.left;
  autocomplete.style.top = (inputLoc.top + input.offsetHeight) + 'px';
  autocomplete.style.display = 'block';
  if (inputLoc.top + autocomplete.offsetHeight > window.pageYOffset + window.innerHeight) {
    var y = inputLoc.top - autocomplete.offsetHeight;
    if (y > 0) {
      autocomplete.style.top = y + 'px';
    }
  }
};

ReadLineInterface.prototype.getAutoCompleteValue = function (idx) {
  idx = idx || this.getSelectedAutoCompleteItemIndex();
  if (idx === -1) {
    return null;
  }
  var autocomplete = document.getElementById('_readline_autocomplete');
  return autocomplete.children[idx].getAttribute('data-value');
};

ReadLineInterface.prototype.getAutoCompleteCount = function () {
  var autocomplete = document.getElementById('_readline_autocomplete');
  return autocomplete.children.length;
};

ReadLineInterface.prototype.getSelectedAutoCompleteItemIndex = function () {
  var autocomplete = document.getElementById('_readline_autocomplete');
  for (var i = 0; i < autocomplete.children.length; i++) {
    if (autocomplete.children[i].className === 'selected') {
      return i;
    }
  }
  return -1;
};

ReadLineInterface.prototype.setSelectedAutoCompleteItemIndex = function (idx) {
  var autocomplete = document.getElementById('_readline_autocomplete');
  for (var i = 0; i < autocomplete.children.length; i++) {
    autocomplete.children[i].className = i === idx ? 'selected' : '';
  }
};

ReadLineInterface.prototype._onSubmit = function (e) {
  var input = document.getElementById('_readline_input');
  var line = input.value;
  this.history.push(line);
  this._historyIdx = this.history.length;
  this._currentInput = '';
  this.emit("line", line);
  this.prompt();
  return preventDefault(e);
};

ReadLineInterface.prototype.question = function (query, callback) {
  throw new Error("Not Implemented (question)");
};

ReadLineInterface.prototype.pause = function () {
  var input = document.getElementById('_readline_input');
  input.disabled = 'disabled';
};

ReadLineInterface.prototype.resume = function () {
  var input = document.getElementById('_readline_input');
  input.disabled = '';
};

ReadLineInterface.prototype.close = function () {
};

ReadLineInterface.prototype.write = function (data, key) {
  this._options.write(data);
};

function preventDefault(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  return false;
}

function getOffset(el) {
  var _x = 0;
  var _y = 0;
  while (el && !isNaN(el.offsetLeft) && !isNaN(el.offsetTop)) {
    _x += el.offsetLeft - el.scrollLeft;
    _y += el.offsetTop - el.scrollTop;
    el = el.offsetParent;
  }
  return { top: _y, left: _x };
}

function addEvent(elem, eventName, fn) {
  if (elem.addEventListener) {
    elem.addEventListener(eventName, fn, false);
  } else if (elem.attachEvent) {
    elem.attachEvent('on' + eventName, fn, false);
  }
}
},{"events":1,"util":5}]},{},[6]);
