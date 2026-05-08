/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a0e14',
        surface: {
          DEFAULT: '#121821',
          1: '#161e2a',
          2: '#1a2230',
        },
        divider: {
          DEFAULT: '#222e3f',
          strong: '#2c3a4f',
        },
        fg: {
          DEFAULT: '#f5f9ff',
          muted: '#9aa9bc',
          faint: '#5b6b80',
        },
        accent: {
          DEFAULT: '#177AA9',
          light: '#3DA3D2',
          dim: '#0e5a7e',
        },
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
      boxShadow: {
        'glow-accent': '0 0 0 1px rgba(23,122,169,0.4), 0 4px 20px rgba(23,122,169,0.15)',
        'panel': '0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}
