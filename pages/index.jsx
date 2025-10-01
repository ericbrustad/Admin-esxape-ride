// pages/index.jsx
export async function getServerSideProps() {
  const variant = process.env.NEXT_PUBLIC_ADMIN_VARIANT === 'v2' ? '/index02' : '/index01';
  return { redirect: { destination: variant, permanent: false } };
}
export default function Home(){ return null; }
