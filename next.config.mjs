/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
    // Enables `src/instrumentation.ts` — installs global error handlers
    // BEFORE any user code, so a stale Supabase refresh-token can never
    // crash the Node process (which previously caused 502 from nginx).
    instrumentationHook: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
};

export default nextConfig;
