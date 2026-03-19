import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#FFFFFF",
          secondary: "#F9FAFB",
          tertiary: "#F3F4F6",
        },
        ink: {
          DEFAULT: "#111827",
          secondary: "#6B7280",
          muted: "#9CA3AF",
          faint: "#D1D5DB",
        },
        edge: {
          DEFAULT: "#E5E7EB",
          strong: "#D1D5DB",
        },
        amber: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          600: "#D97706",
          700: "#B45309",
        },
        emerald: {
          50: "#ECFDF5",
          600: "#059669",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Helvetica Neue", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
