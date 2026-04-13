import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ],
  },
};

export default nextConfig;
