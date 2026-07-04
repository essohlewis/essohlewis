/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1C2030',
          soft: '#5A607F',
          dark: '#F3F4F6',
          darkSoft: '#9CA3AF'
        },
        paper: {
          DEFAULT: '#F5F6F8',
          dark: '#0F172A'
        },
        panel: {
          DEFAULT: '#FFFFFF',
          dark: '#1E293B'
        },
        line: {
          DEFAULT: '#E2E6EE',
          dark: '#334155'
        },
        taskAmber: '#C4732B',
        taskSage: '#6B8F71',
        taskRose: '#B5544A',
        taskBlue: '#2563EB'
      },
      borderRadius: {
        task: '12px'
      }
    },
  },
  plugins: [],
};
