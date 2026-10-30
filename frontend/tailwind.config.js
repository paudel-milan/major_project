/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Lexend Deca', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Roboto Mono', 'Consolas', 'monospace'],
      },
      colors: {
        mt: {
          bg: '#323437',
          'bg-dark': '#2c2e31',
          'bg-darker': '#232427',
          accent: '#e2b714',
          'accent-dim': '#b89410',
          text: '#d1d0c5',
          sub: '#646669',
          error: '#ca4754',
          success: '#7ec984',
        },
      },
    },
  },
  plugins: [],
}
