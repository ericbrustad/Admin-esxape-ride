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

  const metadata = {
    repoName: repoName || 'unknown-repo',
    branchName: branchName || 'unknown-branch',
    commitSha: commitSha || 'unknown-commit',
    commitShaShort: commitSha ? commitSha.slice(0, 8) : (commitSha || 'unknown').slice(0, 8),
    deploymentUrl: deploymentUrl || '—',
    nodeVersion: process.version,
    generatedAt: new Date().toISOString(),
  };

  const conversationLog = [
    {
      speaker: 'Operator',
      message:
        'Research whatever it takes to keep pnpm from failing, forbid Corepack from installing it, and surface the repo/branch/commit snapshot at the bottom of settings.',
    },
    {
      speaker: 'GPT',
      message:
        'Pointed the build doc to the offline pnpm shim, reiterated the Node 22 requirement, and kept the live repository metadata footer to satisfy QA.',
    },
    {
      speaker: 'Operator',
      message:
        'Vercel installs are failing because apps/admin still requires Node <20. Fix the engine constraint (line 6) and resolve any conflicts.',
    },
    {
      speaker: 'GPT',
      message:
        'Aligned the admin panel engine field to Node 22 so workspace installs succeed under the unified runtime expectation.',
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
          <span className="badge">Node target: 22 Active</span>
        </header>
        <div className="sample">
          <strong>Build safeguards</strong>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>
              Use the local shim with <code>node tools/offline-pnpm.mjs --filter game-web build</code> (or <code>dev</code>) so no environment depends on Corepack provisioning pnpm.
            </li>
            <li>
              Maintain an offline copy of <code>pnpm-lock.yaml</code> plus <code>node_modules</code> so dependency restores never invoke Corepack or remote registries mid-build.
            </li>
            <li>
              Pin Node to <code>22</code> across Vercel, CI, and local development to align with the deployment runtime.
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
