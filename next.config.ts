import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable static export compatibility
  output: undefined, // Use default (server) for API routes

  // Transpile packages that need it
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],

  // Headers for camera/mic permissions
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=(*), microphone=(*)',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
