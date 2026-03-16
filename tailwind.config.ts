
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#e6fafb',
          100: '#b3f0f3',
          200: '#80e7eb',
          300: '#5de0e6',
          400: '#3dd4db',
          500: '#2bbcc3',
          600: '#1a9ea5',
          700: '#0d7f86',
          800: '#046068',
          900: '#004aad',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
