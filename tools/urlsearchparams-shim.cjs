const NativeURLSearchParams = globalThis.URLSearchParams;

if (typeof NativeURLSearchParams === 'function') {
  const methods = ['append', 'delete', 'get', 'getAll', 'has', 'set', 'sort'];
  for (const method of methods) {
    const original = NativeURLSearchParams.prototype[method];
    if (typeof original !== 'function') continue;

    NativeURLSearchParams.prototype[method] = function patched(...args) {
      let target = this;
      if (!(target instanceof NativeURLSearchParams)) {
        if (args.length && args[0] instanceof NativeURLSearchParams) {
          target = args.shift();
        } else if (target && typeof target === 'object' && target.constructor === NativeURLSearchParams) {
          // cross-realm fallback
        } else {
          throw new TypeError('Value of "this" must be of type URLSearchParams');
        }
      }
      return original.apply(target, args);
    };
  }
}
