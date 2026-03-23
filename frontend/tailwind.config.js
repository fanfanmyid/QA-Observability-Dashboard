/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0F172A',
          panel: '#1E293B',
          border: '#334155'
        },
        primary: '#3B82F6',
        accent: '#10B981',
        danger: '#EF4444'
      }
    },
  },
  plugins: [],
}
