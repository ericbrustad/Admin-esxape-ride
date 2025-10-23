#!/usr/bin/env node
// Prints toolchain versions at build time; warns (does not fail) if Node is outside >=19 <20.
import { execSync } from "node:child_process";

function safe(cmd) {
  try { return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }
  catch { return ""; }
}

console.log("=== VERCEL BUILD TOOLCHAIN ===");
console.log("node:", process.version);
const corepackV = safe("corepack --version") || "(unavailable)";
const pnpmV     = safe("pnpm -v") || "(unavailable)";
console.log("corepack:", corepackV);
console.log("pnpm:", pnpmV);

const major = Number(process.version.slice(1).split(".")[0]);
if (major < 19 || major >= 20) {
  console.warn("WARN: Node runtime is outside the >=19 <20 target; continuing (non-fatal).");
} else {
  console.log("OK: Node >=19 <20 range confirmed.");
}
console.log("================================");
