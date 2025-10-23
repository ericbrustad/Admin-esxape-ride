#!/usr/bin/env node
// Prints toolchain versions at build time; warns (does not fail) if Node is outside the Node 22 series.
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
if (Number.isFinite(major) && major === 22) {
  console.log("OK: Node 22 detected.");
} else if (Number.isFinite(major) && major > 22) {
  console.warn("WARN: Node runtime is newer than the pinned 22.x target; double-check compatibility.");
} else {
  console.warn("WARN: Node runtime is below the required 22.x target; update your environment.");
}
console.log("================================");
