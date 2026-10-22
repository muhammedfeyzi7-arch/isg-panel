import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        "surface-2": v("surface-2"),
        border: v("border"),
        fg: v("fg"),
        muted: v("muted"),
        subtle: v("subtle"),
        primary: v("primary"),
        "primary-fg": v("primary-fg"),
        positive: v("positive"),
        warning: v("warning"),
        negative: v("negative"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: { xl: "0.875rem", "2xl": "1.125rem" },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.04), 0 1px 1px rgb(0 0 0 / 0.02)",
        pop: "0 12px 32px -8px rgb(0 0 0 / 0.25)",
      },
    },
  },
  plugins: [],
};
export default config;
