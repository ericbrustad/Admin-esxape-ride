// app/layout.tsx
import './globals.css';
import 'leaflet/dist/leaflet.css'; // Leaflet CSS must be global

export const metadata = {
  title: 'Escape Ride Admin',
  description: 'Admin console for scavenger hunt setup',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
