/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'kkradbgupridlcisixet.supabase.co',
      }
    ],
  },
}

module.exports = nextConfig
