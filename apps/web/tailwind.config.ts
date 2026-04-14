import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff7f0",
          100: "#ffedd9",
          200: "#ffd7b3",
          300: "#ffbc82",
          400: "#f99650",
          500: "#f68a4c",
          600: "#e06e2f",
          700: "#ba5524",
          800: "#954521",
          900: "#793b1f",
          950: "#411c0e",
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
