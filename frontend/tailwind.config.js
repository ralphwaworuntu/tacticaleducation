import defaultTheme from 'tailwindcss/defaultTheme';
import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F4F7FB',
          100: '#E8EEF8',
          200: '#C9D6EC',
          300: '#8AA3D0',
          400: '#3B6BC4',
          500: '#17336B',
          600: '#122A56',
          700: '#0C2034',
          800: '#081628',
          900: '#050E1A',
        },
        accent: {
          blue: '#3478F6',
          teal: '#159E9B',
          purple: '#8660D1',
          amber: '#E8A33A',
        },
        electric: '#3478F6',
        gold: '#E8A33A',
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
