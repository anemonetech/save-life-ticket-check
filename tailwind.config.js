/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette inspirée des billets "Journée Caritative"
        brand: {
          red: '#B11116',
          redDark: '#7E0C10',
          gold: '#F5B400',
          goldLight: '#FBD24B',
          cream: '#EDE3D2',
          ink: '#1c1410',
        },
      },
      fontFamily: {
        display: ['"Archivo Black"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        ticket: '0 10px 40px -10px rgba(126, 12, 16, 0.45)',
      },
    },
  },
  plugins: [],
}
