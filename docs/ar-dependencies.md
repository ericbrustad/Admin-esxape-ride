# AR Dependency Guidance

The platform should rely exclusively on non-binary JavaScript dependencies to avoid browser load failures.

## Recommended Packages
- [`three`](https://www.npmjs.com/package/three) for WebGL scene management.
- [`@react-three/fiber`](https://www.npmjs.com/package/@react-three/fiber) (pinned to `^8.15.17`) for React-based scene composition compatible with React 18.
- [`mind-ar`](https://www.npmjs.com/package/mind-ar) (pinned to `^1.2.2`) for WebAR image tracking without native binaries.
- [`zustand`](https://www.npmjs.com/package/zustand) for lightweight state management without native bindings.

## Installation
```bash
npm install three @react-three/fiber@^8.15.17 mind-ar@^1.2.2 react@^18.2.0 react-dom@^18.2.0 zustand
```

All packages above ship text-based assets only, preventing native binary downloads and avoiding node-gyp build failures such as the `canvas` module compilation error observed during deployment. The explicit React and React DOM pins ensure compatibility with `@react-three/fiber@^8.15.17` while satisfying frameworks (e.g., Next.js 14) that expect React 18.2 peer dependencies.

## Optional Dependency Guardrails
- The project now enforces `optional=false` via the repository `.npmrc` file so the `canvas` optional dependency bundled with some AR libraries is never downloaded during CI/CD installs.
- Keep Node.js at 20.x and npm at 9.x or later to satisfy engine constraints defined in `package.json` without triggering native rebuilds.
- If a future AR package adds new optional binaries, extend `.npmrc` or replace the dependency with a pure JavaScript alternative before enabling installs.
