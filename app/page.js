import toggleConfig from '../config/toggle.json';
import gameSettings from '../config/game/settings.json';

function StatusCard({ title, status, details }) {
  return (
    <section className="status-card">
      <h2>{title}</h2>
      <p className="status-value">{status}</p>
      <dl>
        {details.map(({ label, value }) => (
          <div key={label} className="status-row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function Home() {
  const toggle = toggleConfig.switchToggle;
  const game = gameSettings;

  const toggleDetails = [
    { label: 'Password', value: toggle.password },
    { label: 'Default State', value: toggle.defaultState.toUpperCase() },
    { label: 'Verified Intact', value: toggle.verifiedIntact ? 'Yes' : 'No' },
    { label: 'Last Verified', value: toggle.lastVerifiedAt },
  ];

  const gameDetails = [
    { label: 'Folder', value: game.folder },
    { label: 'Enabled', value: game.enabled ? 'Yes' : 'No' },
    { label: 'Status', value: game.status.toUpperCase() },
    { label: 'Last Checked', value: game.lastCheckedAt },
  ];

  return (
    <main className="container">
      <header>
        <h1>Admin Escape Ride Operations Console</h1>
        <p>Please review the README before making any changes. The switch must remain OFF unless explicitly authorized.</p>
      </header>

      <div className="grid">
        <StatusCard title="Switch Toggle" status={toggle.defaultState.toUpperCase()} details={toggleDetails} />
        <StatusCard title="Game Folder" status={game.status.toUpperCase()} details={gameDetails} />
      </div>

      <footer>
        <p>
          Reference documentation:
          {' '}
          <a href="/docs/ar-dependencies" rel="noreferrer">
            AR Dependency Guidance
          </a>
          {' '}and repository README.
        </p>
      </footer>
    </main>
  );
}
