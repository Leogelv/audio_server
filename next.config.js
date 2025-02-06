/** @type {import('next').NextConfig} */
const nextConfig = {
  // Увеличиваем лимиты для Edge Runtime
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb'
    },
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
} 