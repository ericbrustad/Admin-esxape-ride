/**
 * index.jsx (redirector)
 * Set NEXT_PUBLIC_ADMIN_VARIANT to 'v2' to use /index02 as home.
 * Anything else uses /index01.
 */

export async function getServerSideProps() {
  const dest = process.env.NEXT_PUBLIC_ADMIN_VARIANT === 'v2' ? '/index02' : '/index01';
  return { redirect: { destination: dest, permanent: false } };
}

export default function Home(){ return null; }
