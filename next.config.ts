import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  productionBrowserSourceMaps: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'github.com' },
    ],
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'framer-motion',
      'motion',
      '@radix-ui/react-icons',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      'echarts',
      'echarts-for-react',
    ],
  },
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.watchOptions = {
        aggregateTimeout: 300,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/backend/**',
          '**/deploy/**',
          '**/sdks/**',
          '**/cli/**',
          '**/.next/**',
        ],
      };
    }

    // Dynamic Route Code-Splitting & Tree-Shaking for Heavy Bundles (Three.js, Monaco, Echarts)
    if (!isServer && config.optimization?.splitChunks) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        chunks: 'all',
        maxInitialRequests: 25,
        minSize: 20000,
        cacheGroups: {
          ...(config.optimization.splitChunks.cacheGroups || {}),
          threejs: {
            test: /[\\/]node_modules[\\/](three|@react-three)[\\/]/,
            name: 'chunk-threejs',
            priority: 40,
            chunks: 'async',
            reuseExistingChunk: true,
          },
          monaco: {
            test: /[\\/]node_modules[\\/](monaco-editor|@monaco-editor)[\\/]/,
            name: 'chunk-monaco',
            priority: 40,
            chunks: 'async',
            reuseExistingChunk: true,
          },
          echarts: {
            test: /[\\/]node_modules[\\/](echarts|echarts-for-react)[\\/]/,
            name: 'chunk-echarts',
            priority: 35,
            chunks: 'async',
            reuseExistingChunk: true,
          },
          framework: {
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            name: 'chunk-framework',
            priority: 50,
            chunks: 'all',
            reuseExistingChunk: true,
          },
        },
      };
    }

    return config;
  },
};

export default nextConfig;
