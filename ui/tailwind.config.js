/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'game-dark': '#0a2463',
        'game-blue': '#3e92cc',
        'game-light': '#5ca4d5',
        'game-gold': '#FFD700',
      },
    },
  },
  plugins: [],
}

