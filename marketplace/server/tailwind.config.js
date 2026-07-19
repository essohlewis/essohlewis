/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.html", "./views/**/*.html"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#f97316", dark: "#ea580c" },
        accent: { DEFAULT: "#0f9d58", soft: "#e5f6ec" },
      },
      borderRadius: { xl2: "1rem" },
    },
  },
  plugins: [],
};
