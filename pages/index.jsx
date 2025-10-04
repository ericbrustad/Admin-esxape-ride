import dynamic from 'next/dynamic';

const AdminApp = dynamic(() => import('../src/AdminApp'), {
  ssr: false,
  loading: () => (
    <main style={{ padding: 20, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial' }}>
      Loading Admin…
    </main>
  ),
});

export async function getServerSideProps() {
  return { props: {} };
}

export default function Page() {
  return <AdminApp />;
}
