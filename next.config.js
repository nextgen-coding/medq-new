/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  images: {
    domains: ['localhost', 'utfs.io', 'uploadthing.com', 'k5kuw9ehqm.ufs.sh', 'ufs.sh', 'r5p6ptp1nn.ufs.sh', 'hbc9duawsb.ufs.sh'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    // Ensure pdfjs-dist resolves even when hoisted (react-pdf expects nested path sometimes)
    try {
      const pdfMain = require.resolve('pdfjs-dist/build/pdf.mjs');
      const pdfWorker = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs');
      config.resolve = config.resolve || {};
      config.resolve.alias = config.resolve.alias || {};
      config.resolve.alias['pdfjs-dist/build/pdf.mjs'] = pdfMain;
      config.resolve.alias['pdfjs-dist/build/pdf.worker.mjs'] = pdfWorker; // fallback alias
      config.resolve.alias['pdfjs-dist/build/pdf.worker.min.mjs'] = pdfWorker;
    } catch (e) {
      console.warn('[next.config] Could not set pdfjs-dist aliases', e);
    }
    return config;
  }
}

module.exports = nextConfig 