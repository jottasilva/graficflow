import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: [],
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "wlxuevhxnxyvvjtocnrc.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // turbopack: {},
};

export default nextConfig;
