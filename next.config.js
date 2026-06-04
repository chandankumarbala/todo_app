/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.TAURI_ENV_TARGET_TRIPLE ? { output: 'export' } : {}),
  async rewrites() {
    if (process.env.NODE_ENV === 'production') return []
    if (process.env.TAURI_ENV_TARGET_TRIPLE) return []
    return [
      { source: '/api/:path*', destination: 'http://localhost:3848/api/:path*' },
    ]
  },
}
module.exports = nextConfig
