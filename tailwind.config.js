/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        neon: {
          pink: '#FF2288',
          purple: '#8822FF',
          cyan: '#00FFCC',
          yellow: '#FFDD00',
          dark: '#0F0A1F',
          darker: '#080514',
        }
      },
      backgroundImage: {
        'neon-gradient': 'linear-gradient(135deg, #FF2288 0%, #8822FF 50%, #2200AA 100%)',
        'neon-gradient-soft': 'linear-gradient(135deg, rgba(255,34,136,0.2) 0%, rgba(136,34,255,0.2) 100%)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'bounce-slow': 'bounce 2s infinite',
        'shake': 'shake 0.5s ease-in-out',
        'flip': 'flip 0.8s ease-in-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255,34,136,0.5), 0 0 40px rgba(136,34,255,0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(255,34,136,0.8), 0 0 80px rgba(136,34,255,0.5)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px)' },
          '75%': { transform: 'translateX(5px)' },
        },
        'flip': {
          '0%': { transform: 'rotateY(0deg)' },
          '50%': { transform: 'rotateY(90deg)' },
          '100%': { transform: 'rotateY(0deg)' },
        }
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
};
