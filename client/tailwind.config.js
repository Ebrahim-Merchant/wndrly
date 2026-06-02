/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Wndrly coral palette
        coral: {
          50:  '#fff1ef',
          100: '#ffe0db',
          200: '#ffc5bc',
          300: '#ffa095',
          400: '#f87060',
          500: '#f25c4a',
          600: '#e04535',
          700: '#c43020',
          800: '#a32518',
          900: '#7d1b11',
          950: '#4a0c07',
        },
        // Wndrly sand (light mode bg)
        sand: {
          50:  '#fef9f3',
          100: '#fdf8f2',
          200: '#f9f0e3',
          300: '#f5e5cf',
          400: '#f0d5b5',
          500: '#e8c490',
          600: '#d4a860',
          700: '#b8883a',
          800: '#8f6527',
          900: '#5e4018',
        },
        // Dark surface palette
        surface: {
          DEFAULT: '#131315',
          low:     '#1c1b1d',
          container: '#201f22',
          high:    '#2a2a2c',
          highest: '#353437',
        },
        // Keep existing primary for backwards compat, but now maps to coral
        primary: {
          50:  '#fff1ef',
          100: '#ffe0db',
          200: '#ffc5bc',
          300: '#ffa095',
          400: '#f87060',
          500: '#f25c4a',
          600: '#e04535',
          700: '#c43020',
          800: '#a32518',
          900: '#7d1b11',
          950: '#4a0c07',
        },
        planner: {
          day: '#f8fafc',
          dayBorder: '#e2e8f0',
          dayHeader: '#1e293b',
          sidebar: '#ffffff',
          sidebarBorder: '#f1f5f9',
          overlay: 'rgba(15, 23, 42, 0.4)',
          dragActive: '#fff1ef',
          dragOver: '#ffc5bc',
        },
      },
      boxShadow: {
        'day-column': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'place-card': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'drag-overlay': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'glass': '0 4px 30px rgba(0, 0, 0, 0.1)',
        'glass-dark': '0 4px 30px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
}
