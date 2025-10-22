# GPT Research Log

> Timestamp: 2025-10-22T12:06:29Z

**Developer ↔ GPT Diagnostic Thread**

**Developer:** I'm seeing the Vercel CLI 48.2.9 install fail with `Value of "this" must be of type URLSearchParams`. Could this be coming from our code?

**GPT Advisor:** That error typically fires when something calls a `URLSearchParams` prototype method without the right instance. Check any polyfills or helpers that might mutate the prototype. If we don't patch prototypes, the CLI should behave.

**Developer:** We don't patch URLSearchParams today. Maybe we can neutralize the CLI quirk by binding the methods ourselves while keeping behaviour intact.

**GPT Advisor:** Right—patching the environment before the CLI runs is a safe guardrail. A tiny shim that enforces proper binding would keep third-party code from tripping over the prototype edge cases.

**Developer:** Got it. I'll ship the shim and surface the repo snapshot in the in-game settings so QA can confirm the environment details from the client side, too.

---

> Timestamp: 2025-10-22T15:41:12Z

**Developer ↔ GPT Diagnostic Thread**

**Developer:** Vercel's build log still fails during `pnpm install` with `ERR_INVALID_THIS` and `Value of "this" must be of type URLSearchParams`. We've already added the CLI shim—any idea what else can cause this?

**GPT Advisor:** Those errors usually happen when Corepack boots an incompatible pnpm version for the Node runtime on the build host. Vercel's Turbo jobs often pull Node 18 unless you pin it.

**Developer:** So we should force Node 20 LTS so pnpm 9.x matches the runtime?

**GPT Advisor:** Exactly. Add a `.node-version` (and optionally `.nvmrc`) at the repo root with a Node 20 LTS value like `20.11.1`. That keeps Corepack aligned and stabilizes `pnpm install` in CI.

**Developer:** Perfect. I'll drop the version file and rerun the build to verify the installer succeeds.
