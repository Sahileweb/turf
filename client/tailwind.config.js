export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        pitch: {
          dark: '#071A0F',
          deep: '#0A2D18',
          mid: '#0F4023',
        },
        grass: {
          bright: '#22C55E',
          mid: '#16A34A',
        },
        gold: '#F59E0B',
      }
    },
  },
  plugins: [],
}