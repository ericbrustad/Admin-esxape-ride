# AR Dependency Guidance

The platform should rely exclusively on non-binary JavaScript dependencies to avoid browser load failures.

## Recommended Packages
- [`three`](https://www.npmjs.com/package/three) for WebGL scene management.
- [`@react-three/fiber`](https://www.npmjs.com/package/@react-three/fiber) for React-based scene composition.
- [`mind-ar`](https://www.npmjs.com/package/mind-ar-js) (installed via the alias `mind-ar@npm:mind-ar-js@^1.2.4`) for WebAR image tracking without native binaries.
- [`zustand`](https://www.npmjs.com/package/zustand) for lightweight state management without native bindings.

## Installation
```bash
npm install three @react-three/fiber mind-ar@npm:mind-ar-js@^1.2.4 zustand
```

The alias keeps import paths unchanged while resolving to the pure JavaScript `mind-ar-js` package. All packages above ship text-based assets only, preventing native binary downloads and avoiding node-gyp build failures such as the `canvas` module compilation error observed during deployment.
