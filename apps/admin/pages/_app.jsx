// CODEX NOTE: Injects the global Settings (top-right) into every page
// and installs the global bridge so actions work on all routes.
import '../styles/globals.css';
import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminSettingsRoot from '../components/AdminSettingsRoot';
import { installGlobalSettingsBridge } from '../lib/settingsBridge';

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    const cleanup = installGlobalSettingsBridge(router);
    return cleanup;
  }, [router.asPath]);

  return (
    <>
      <AdminSettingsRoot />
      <Component {...pageProps} />
    </>
  );
}
