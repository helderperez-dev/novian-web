import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@whiskeysockets/baileys', 'pino', 'jimp', 'sharp'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.olx.com.br',
      },
      {
        protocol: 'https',
        hostname: '**',
      }
    ],
  },
};

export default nextConfig;
