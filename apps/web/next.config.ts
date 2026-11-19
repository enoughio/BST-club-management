import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Local `next dev` only. On Vercel, vercel.json sends `/api` to the api service
    // before this app sees the request. Bindings are not available in this config.
    const api = process.env.API_PROXY_URL || "http://localhost:4000";
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
};

export default nextConfig;
