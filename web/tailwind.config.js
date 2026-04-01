/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bgPrimary: "#001a2b",
        accent: "#DDFF55",
        glass: "rgba(192,214,234,0.07)",
        textMuted: "rgba(192,214,234,0.7)",
        borderGlass: "rgba(192,214,234,0.15)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "Noto Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};
