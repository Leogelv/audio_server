/** @type {import('next').NextConfig} */
const nextConfig = {
  // Настройки для Edge Runtime
  experimental: {
    serverActions: true,
    serverComponentsExternalPackages: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  // Настройки для API роутов
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
    responseLimit: false,
  },
  // Отключаем строгий мод для внешних ресурсов
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Настройки для Vercel
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
}

module.exports = nextConfig; 