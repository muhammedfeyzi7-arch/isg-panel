/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        "fade-in": { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "slide-up": { "0%": { transform: "translateY(100%)" }, "100%": { transform: "translateY(0)" } },
        "scan-line": { "0%": { top: "8px" }, "50%": { top: "calc(100% - 8px)" }, "100%": { top: "8px" } },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "scan-line": "scan-line 2s ease-in-out infinite",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#059669",
          hover: "#047857",
        },
        brand: {
          bg: "#F8FAFC",
          border: "#E2E8F0",
          heading: "#0F172A",
          body: "#334155",
          soft: "#64748B",
        },
      },
    },
  },
  plugins: [],
}
