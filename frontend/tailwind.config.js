/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./login.html",
    "./signin.html",
    "./agent-login.html",
    "./reset-password.html",
    "./forgot-password.html",
    "./apropos.html",
    "./app/**/*.html",
    "./pourqui/**/*.html",
    "./js/**/*.js",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: "#0088CC",
        secondary: "#102C4C",
        "brand-dark-blue": "#4A6076",
        "background-light": "#F5F7FA",
        "background-dark": "#111827",
        "surface-light": "#FFFFFF",
        "surface-dark": "#1F2937",
        "text-main-light": "#111827",
        "text-main-dark": "#F9FAFB",
        "text-muted-light": "#6B7280",
        "text-muted-dark": "#9CA3AF",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        'xl': '1rem',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
