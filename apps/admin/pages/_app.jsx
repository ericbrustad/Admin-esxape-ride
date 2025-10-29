import '../styles/globals.css';
import AdminSettingsRoot from '../components/AdminSettingsRoot';

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <AdminSettingsRoot />
      <Component {...pageProps} />
    </>
  );
}
