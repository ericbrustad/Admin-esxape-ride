import React from 'react';
import { execSync } from 'child_process';

function safeExec(command) {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch (error) {
    return '';
  }
}

export async function getServerSideProps() {
  const env = process.env || {};
  const repoPath = safeExec('git rev-parse --show-toplevel');
  const repoName = env.VERCEL_GIT_REPO_SLUG || (repoPath ? repoPath.split(/[\\/]/).filter(Boolean).pop() : '');
  const branchName = env.VERCEL_GIT_COMMIT_REF || safeExec('git rev-parse --abbrev-ref HEAD');
  const commitSha = env.VERCEL_GIT_COMMIT_SHA || safeExec('git rev-parse HEAD');
  const deploymentUrl = env.VERCEL_URL ? `https://${env.VERCEL_URL}` : env.DEPLOYMENT_URL || '';
  const yarnVersion = safeExec('yarn --version');

  const metadata = {
    repoName: repoName || 'unknown-repo',
    branchName: branchName || 'unknown-branch',
    commitSha: commitSha || 'unknown-commit',
    commitShaShort: commitSha ? commitSha.slice(0, 8) : (commitSha || 'unknown').slice(0, 8),
    deploymentUrl: deploymentUrl || '—',
    nodeVersion: process.version,
    nodeTarget: '22.x',
    yarnVersion: yarnVersion || '(unavailable)',
    generatedAt: new Date().toISOString(),
  };

  const conversationLog = [
    {
      speaker: 'Operator',
      message:
        'Work on game-esxape-ride and make sure no environment points at Node twenty-two—keep everything in the Node >=19 <20 range. Keep the repo, branch, commit, and Vercel snapshot visible with the current date and time.',
    },
    {
      speaker: 'GPT',
      message:
        'Updated the Settings view and package engines to enforce the Node 19.x target, double-checked metadata rendering, and logged this exchange for QA reference.',
    },
    {
      speaker: 'Operator',
      message:
        'Corepack keeps failing to provision pnpm. Enable Corepack with ENABLE_EXPERIMENTAL_COREPACK=1, verify any proxy limits, prefer the node tools/offline-pnpm.mjs helper, and document the troubleshooting steps alongside the deployment metadata.',
    },
    {
      speaker: 'GPT',
      message:
        'Captured the Corepack diagnostics guidance, reiterated the offline pnpm workflow, and confirmed the repository snapshot renders with branch, commit, deployment URL, and refreshed timestamp.',
    },
    {
      speaker: 'Operator',
      message:
        'Rerun pnpm directly and make sure it tests clean—document the outcome and keep the GPT ↔ operator transcript visible.',
    },
    {
      speaker: 'GPT',
      message:
        'Attempted pnpm --filter game-web build through Corepack, recorded the proxy/tunneling failure, then validated the project with the offline pnpm shim to ensure builds continue succeeding inside the Node >=19 <20 target.',
    },
    {
      speaker: 'Operator',
      message:
        'Document practical steps so the team can unblock Corepack: lean on the offline pnpm helper, try a local global pnpm install, configure proxy variables, and keep an offline cache handy.',
    },
    {
      speaker: 'GPT',
      message:
        'Expanded the safeguards with proxy configuration, global pnpm installation, and offline install guidance while reaffirming the offline helper workflow, then noted the npm 403 block when attempting a global pnpm install inside this environment.',
    },
    {
      speaker: 'Operator',
      message:
        'The npm proxy is still denying pnpm with a 403. Update the instructions: document .npmrc proxy entries, call out strict-ssl overrides, alternative registries, manual pnpm downloads, cache cleans, log inspection, and offline installs.',
    },
    {
      speaker: 'GPT',
      message:
        'Captured the extended remediation checklist covering .npmrc proxy mirroring, security policy verification, strict-ssl overrides, alternative registries, manual pnpm binaries, cache purges, log review, and offline reinstall tactics so the team has multiple fallback paths.',
    },
    {
      speaker: 'Operator',
      message:
        'Run the offline helper again without Corepack pulling pnpm, write the workaround into the README, wire npm scripts so we can switch between offline and standard builds, and keep debugging notes in the log.',
    },
    {
      speaker: 'GPT',
      message:
        'Promoted the offline shim to the default npm build script, kept a build:standard alias for pnpm/Corepack diagnostics, documented the workflow in the README, refreshed safeguards to stress the non-Corepack path, reran the shim build, and archived the change log.',
    },
    {
      speaker: 'Operator',
      message:
        'Vercel rejects the build unless Node 22.x is declared. Update every engine declaration and safeguard so the runtime target matches the platform requirement and document the change in the logs.',
    },
    {
      speaker: 'GPT',
      message:
        'Shifted the game workspace to Node 22.x, updated the build diagnostics to flag non-22 runtimes, refreshed the safeguards and README notes, reran the offline build, and captured this conversation for the Settings log.',
    },
    {
      speaker: 'Operator',
      message:
        'Drop pnpm entirely in favor of Yarn, wire the build scripts to Yarn workspaces, and make sure the documentation and safeguards show the new commands.',
    },
    {
      speaker: 'GPT',
      message:
        'Converted the repo to Yarn workspaces with node-modules linking, added .yarnrc.yml, updated the Settings safeguards and README, attempted yarn install (captured the proxy 403), and documented the lockfile requirement that blocks yarn build while the workspace Next.js build continues to succeed via the existing binaries.',
    },
  ];

  return {
    props: {
      metadata,
      conversationLog,
    },
  };
}

export default function Settings({ metadata, conversationLog }) {
  const timestamp = metadata?.generatedAt
    ? new Date(metadata.generatedAt).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  return (
    <main className="container" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 32 }}>
      <section className="card">
        <header className="header">
          <div>
            <h1>Game Settings</h1>
            <p className="hint">Environment alignment and QA references for the Escape Ride experience.</p>
          </div>
          <span className="badge">Node target: {metadata.nodeTarget} Active</span>
        </header>
        <div className="sample">
          <strong>Build safeguards</strong>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>
              Align every workspace and deployment target with <code>node 22.x</code> so Vercel builds run without rejecting the runtime declaration.
            </li>
            <li>
              Run <code>yarn install</code> from the repo root to hydrate workspaces. When the proxy blocks registry access (403 Forbidden), capture the logs and mirror them in the README and this safeguards list for network follow-up.
            </li>
            <li>
              Primary builds run through <code>yarn build</code>, which delegates to <code>yarn workspace game-web run build</code>. Until a Yarn lockfile is captured, fall back to <code>node apps/game-web/node_modules/.bin/next build</code> and archive the Yarn lock errors alongside the proxy logs.
            </li>
            <li>
              Use <code>yarn build:admin</code> to compile the admin dashboard when verifying both applications locally.
            </li>
            <li>
              Keep <code>yarn build:turbo</code> available for aggregate builds; it still invokes <code>turbo run build</code> across workspaces.
            </li>
            <li>
              Manage Yarn settings through <code>.yarnrc.yml</code>, ensuring <code>nodeLinker: node-modules</code> stays committed for offline compatibility and telemetry remains disabled.
            </li>
            <li>
              Mirror proxy host/credential details in <code>.npmrc</code>, <code>HTTP(S)_PROXY</code>, and Yarn's <code>npmRegistryServer</code> configuration so installs behave consistently regardless of the CLI in use.
            </li>
            <li>
              Retain the existing <code>node_modules</code> snapshot alongside Yarn logs when installs fail so on-call engineers can reproduce the environment without Corepack.
            </li>
            <li>
              Continue reviewing security policies and SSL enforcement settings if registry access is denied, documenting any temporary overrides applied during troubleshooting.
            </li>
            <li>
              Record all Yarn ↔ proxy remediation attempts (including telemetry prompts and Corepack bootstrap messages) in the conversation log below for QA traceability.
            </li>
          </ul>
        </div>
      </section>

      <section className="card">
        <h2>Conversation Log</h2>
        <p className="hint">Latest operator ↔ GPT coordination for this deployment.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          {conversationLog.map((entry, index) => (
            <div key={`${entry.speaker}-${index}`} style={{ borderLeft: '4px solid var(--border)', paddingLeft: 12 }}>
              <div style={{ fontWeight: 600 }}>{entry.speaker}</div>
              <div style={{ marginTop: 4, lineHeight: 1.5 }}>{entry.message}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: 'auto' }}>
        <h2>Repository Snapshot</h2>
        <p className="hint">Refreshed {timestamp}</p>
        <dl style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px 16px', margin: 0 }}>
          <dt style={{ color: 'var(--muted)' }}>Repository</dt>
          <dd style={{ margin: 0 }}>{metadata?.repoName}</dd>
          <dt style={{ color: 'var(--muted)' }}>Branch</dt>
          <dd style={{ margin: 0 }}>{metadata?.branchName}</dd>
          <dt style={{ color: 'var(--muted)' }}>Commit</dt>
          <dd style={{ margin: 0 }}>
            <code>{metadata?.commitShaShort}</code>
            {metadata?.commitSha && metadata.commitSha !== metadata.commitShaShort ? (
              <span className="hint" style={{ marginLeft: 8 }}>{metadata.commitSha}</span>
            ) : null}
          </dd>
          <dt style={{ color: 'var(--muted)' }}>Deployment</dt>
          <dd style={{ margin: 0 }}>{metadata?.deploymentUrl}</dd>
          <dt style={{ color: 'var(--muted)' }}>Node runtime</dt>
          <dd style={{ margin: 0 }}>{metadata?.nodeVersion}</dd>
          <dt style={{ color: 'var(--muted)' }}>Yarn version</dt>
          <dd style={{ margin: 0 }}>{metadata?.yarnVersion}</dd>
          <dt style={{ color: 'var(--muted)' }}>Target range</dt>
          <dd style={{ margin: 0 }}>{metadata?.nodeTarget}</dd>
        </dl>
      </section>

      <footer
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 13,
          color: 'var(--muted)',
          marginTop: 16,
        }}
      >
        <span>
          {metadata?.repoName} @ {metadata?.branchName} • {metadata?.commitShaShort}
        </span>
        <span>
          {metadata?.deploymentUrl} • {timestamp}
        </span>
      </footer>
    </main>
  );
}
