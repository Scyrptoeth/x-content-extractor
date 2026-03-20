import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mongo: {
          green: "#00ED64",
          "green-dark": "#00684A",
          "forest": "#023430",
          "ink": "#001E2B",
          "slate": "#1C2D38",
          "mist": "#E8EDEB",
          "cloud": "#F9FBFA",
          white: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        mono: ['"Source Code Pro"', "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
