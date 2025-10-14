# AR Dependency Guidance

The platform should rely exclusively on non-binary JavaScript dependencies to avoid browser load failures.

## Recommended Packages
- [`three`](https://www.npmjs.com/package/three) for WebGL scene management.
- [`@react-three/fiber`](https://www.npmjs.com/package/@react-three/fiber) for React-based scene composition.
- [`mind-ar`](https://www.npmjs.com/package/mind-ar) (pinned to `^1.2.2`) for WebAR image tracking without native binaries.
- [`zustand`](https://www.npmjs.com/package/zustand) for lightweight state management without native bindings.

## Installation
```bash
npm install three @react-three/fiber mind-ar@^1.2.2 react@^18.2.0 react-dom@^18.2.0 zustand
```

All packages above ship text-based assets only, preventing native binary downloads and avoiding node-gyp build failures such as the `canvas` module compilation error observed during deployment. The explicit React and React DOM pins ensure compatibility with `@react-three/fiber` while satisfying frameworks (e.g., Next.js 14) that expect React 18.2 peer dependencies.
