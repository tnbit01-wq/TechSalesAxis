import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, "../../"),
  },
  async redirects() {
    return [
      {
        source: "/auth/reset-password",
        destination: "/reset-password",
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.iconscout.com',
      },
      {
        protocol: 'https',
        hostname: 'techsalesaxis-storage.s3.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'techsalesaxis-storage.s3.ap-south-1.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
    ],
  },
};

export default nextConfig;
