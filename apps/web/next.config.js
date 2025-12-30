/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  // Configure rewrites for API calls to backend container
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.INTERNAL_API_URL || 'http://api:8000'}/:path*`,
      },
    ]
  },
  // Allow external access from LAN
  env: {
    HOSTNAME: '0.0.0.0',
  },
}

module.exports = nextConfig