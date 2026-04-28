import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable Turbopack for Next.js 16 (default build tool)
  turbopack: {},
  
  headers: async () => {
    return [
      // Prevent CSS and styled components from caching
      {
        source: '/:path*.(css|js)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate'
          }
        ]
      },
      // Prevent HTML caching across all routes
      {
        source: '/:path((?!_next/static|static|api).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate, no-cache'
          },
          {
            key: 'Pragma',
            value: 'no-cache'
          },
          {
            key: 'Expires',
            value: '0'
          }
        ]
      }
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
    ],
  },
};

export default nextConfig;
