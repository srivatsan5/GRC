import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a separate dev server run next to a production build (e.g. NEXT_DIST_DIR=.next-dev).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Don't write AGENTS.md / CLAUDE.md into the repo on `next dev`.
  agentRules: false,
  // Shown in the footer, from package.json (no hardcoded version strings).
  env: { NEXT_PUBLIC_APP_VERSION: version },
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  experimental: {
    // Tree-shake heavy icon/component libraries for faster compilation
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'framer-motion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-popover',
      '@radix-ui/react-accordion',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-toggle',
      '@radix-ui/react-toggle-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-switch',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-progress',
      '@radix-ui/react-avatar',
      '@radix-ui/react-label',
      '@tanstack/react-query',
      '@tanstack/react-table',
      'date-fns',
    ],
  },
}

export default nextConfig
