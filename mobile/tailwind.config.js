/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#0EA5E9',
        primaryDark: '#0284C7',
        bgDark: '#0a0f1a',
        bgLight: '#f8fafc',
        cardDark: 'rgba(30,41,59,0.95)',
        textDark: '#f1f5f9',
        textLight: '#0f172a',
        muted: '#64748b',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
    },
  },
  plugins: [],
};
