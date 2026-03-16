import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        geo: {
          bg: '#0a0a0f',
          surface: '#12121a',
          border: '#1e1e2e',
          'border-hover': '#2a2a3e',
          text: '#e4e4e7',
          'text-muted': '#71717a',
          accent: '#3b82f6',
          'accent-hover': '#2563eb',
          success: '#22c55e',
          warning: '#f59e0b',
          error: '#ef4444',
          contour: '#8B4513',
          'contour-minor': '#D2B48C',
          water: '#4169E1',
          building: '#404040',
          road: '#666666',
          landuse: '#228B22',
          infra: '#DC143C',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
