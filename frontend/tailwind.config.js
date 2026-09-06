import defaultTheme from 'tailwindcss/defaultTheme';
import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f5ff',
          100: '#dce8f7',
          200: '#b8cfe8',
          300: '#7aa3cc',
          400: '#3d6a99',
          500: '#1e3a8a',
          600: '#162f72',
          700: '#0f255c',
          800: '#091c47',
          900: '#051332',
        },
        slate: {
          950: '#0f172a',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', ...defaultTheme.fontFamily.sans],
      },
      boxShadow: {
        glow: '0 20px 45px rgba(30, 58, 138, 0.25)',
      },
      backgroundImage: {
        'grid-brand':
          'linear-gradient(rgba(30, 58, 138, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(30, 58, 138, 0.15) 1px, transparent 1px)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-700px 0' },
          '100%': { backgroundPosition: '700px 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
