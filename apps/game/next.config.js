/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  poweredByHeader: false,
  // If you later want to restrict iframe embedding to your Admin domain, use:
  // headers: async () => [
  //   {
  //     source: '/:path*',
  //     headers: [
  //       { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://admin.esxaperide.com https://*.vercel.app" }
  //     ],
  //   },
  // ],
};
module.exports = nextConfig;
