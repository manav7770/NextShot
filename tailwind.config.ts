import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0b0c0e",
          soft: "#1a1c20",
        },
        accent: "#ff7a1a",
      },
    },
  },
  plugins: [],
};

export default config;
