/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/sidepanel/**/*.{ts,tsx,html}', './index.html'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070d1a',
          900: '#0b1220',
          800: '#111a2e',
          700: '#1a2540',
          600: '#253256',
        },
        gold: {
          DEFAULT: '#d4af37',
          light: '#e8c95e',
          dark: '#b8912a',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
