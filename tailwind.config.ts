import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        xd: {
          black: "#000000",
          surface: "#16181C",
          elevated: "#202327",
          border: "#2F3336",
          "border-light": "#38444D",
          "text-primary": "#E7E9EA",
          "text-secondary": "#71767B",
          blue: "#1D9BF0",
          "blue-hover": "#1A8CD8",
          "blue-faded": "#1D9BF020",
          green: "#00BA7C",
          "green-faded": "#00BA7C20",
          red: "#F4212E",
          "red-faded": "#F4212E20",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
