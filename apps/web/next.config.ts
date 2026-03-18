import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'cdn.iconscout.com',
      },
      {
        protocol: 'https',
        hostname: 'talentflow-files.s3.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'talentflow-files.s3.ap-southeast-2.amazonaws.com',
      },
    ],
  },
};

export default nextConfig;
