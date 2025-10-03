// pages/_app.tsx
import type { AppProps } from 'next/app';
import 'leaflet/dist/leaflet.css'; // global Leaflet CSS
import '../styles/globals.css';     // your own globals

export default function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
