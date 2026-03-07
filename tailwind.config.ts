import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        plum: {
          DEFAULT: '#8E4585',
          dark: '#6e3467',
        },
        mauve: '#996666',
        rose: '#DCA1A1',
        ink: '#4A4A4A',
        parchment: '#F2F0EF',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
