import './globals.css';

export const metadata = {
  title: 'Admin Escape Ride Controls',
  description: 'Operations console for AR switch management and deployment readiness.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
