import Link from 'next/link';

export const metadata = {
  title: 'AR Dependency Guidance',
};

export default function ArDependenciesPage() {
  return (
    <main className="container">
      <header>
        <h1>AR Dependency Guidance</h1>
        <p>Summarized requirements for maintaining a non-binary AR stack.</p>
      </header>

      <section className="status-card">
        <h2>Install Stack</h2>
        <p>
          Install the following packages exactly as pinned to avoid native binaries and peer conflicts:
        </p>
        <pre>
{`npm install three @react-three/fiber@^8.15.17 mind-ar@^1.2.2 next@^14.2.5 react@^18.2.0 react-dom@^18.2.0 zustand`}
        </pre>
        <p>
          Optional dependencies are disabled by <code>.npmrc</code>, and <code>canvas</code> is mapped to a local stub in
          <code>package.json</code> to keep builds binary-free.
        </p>
      </section>

      <section className="status-card">
        <h2>Further Documentation</h2>
        <p>
          For detailed notes, review the markdown reference kept in the repository:
        </p>
        <p>
          <Link href="https://github.com/ericbrustad/Admin-esxape-ride/blob/work/docs/ar-dependencies.md">
            View docs/ar-dependencies.md on GitHub
          </Link>
        </p>
      </section>

      <footer>
        <p>Always confirm the switch toggle is OFF after dependency changes.</p>
      </footer>
    </main>
  );
}
