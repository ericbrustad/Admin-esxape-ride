# AR Dependency Guidance

The platform should rely exclusively on non-binary JavaScript dependencies to avoid browser load failures.

## Recommended Packages
- [`three`](https://www.npmjs.com/package/three) for WebGL scene management.
- [`@react-three/fiber`](https://www.npmjs.com/package/@react-three/fiber) for React-based scene composition.
- [`mind-ar`](https://www.npmjs.com/package/mind-ar) for WebAR image tracking.
- [`zustand`](https://www.npmjs.com/package/zustand) for lightweight state management without native bindings.

## Installation
```bash
npm install three @react-three/fiber mind-ar zustand
```

All packages above ship pure JavaScript assets and do not introduce native binaries, keeping the deployment portable.
