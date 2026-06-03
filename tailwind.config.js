/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Lobby world: deep wine red background, green poker table, gold/white/black accents
        wine: {
          900: "#3b0a14",
          800: "#4d0f1c",
          700: "#5e1322",
          600: "#7a1a2e",
        },
        felt: {
          900: "#0a3d24",
          800: "#0f5132",
          700: "#157347",
          600: "#1c8a55",
        },
        gold: {
          400: "#f0c75e",
          500: "#d4af37",
          600: "#b8941f",
        },
        // NEON JACK world: black x blue neon
        neon: {
          bg: "#05060f",
          blue: "#28d7ff",
          deep: "#0a1b3d",
          red: "#ff3b5c",
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', "Georgia", "serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        gold: "0 0 0 2px rgba(212,175,55,0.6), 0 8px 24px rgba(0,0,0,0.45)",
        neon: "0 0 6px rgba(40,215,255,0.8), 0 0 18px rgba(40,215,255,0.5)",
        card: "0 10px 24px rgba(0,0,0,0.45)",
      },
      keyframes: {
        deal: {
          "0%": {
            transform: "translateY(-60vh) translateX(-40vw) rotate(-25deg) scale(0.6)",
            opacity: "0",
          },
          "60%": { opacity: "1" },
          "100%": {
            transform: "translateY(0) translateX(0) rotate(var(--card-rot, 0deg)) scale(1)",
            opacity: "1",
          },
        },
        floatUp: {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-10px)" },
        },
        glowPulse: {
          "0%,100%": { boxShadow: "0 0 6px rgba(40,215,255,0.7)" },
          "50%": { boxShadow: "0 0 18px rgba(40,215,255,1)" },
        },
        spinReel: {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-66.666%)" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        chipPop: {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.25)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        deal: "deal 0.55s cubic-bezier(0.2,0.8,0.2,1) both",
        floatUp: "floatUp 0.25s ease-out forwards",
        glowPulse: "glowPulse 1.6s ease-in-out infinite",
        fadeIn: "fadeIn 0.3s ease-out both",
        chipPop: "chipPop 0.4s ease-out",
      },
    },
  },
  plugins: [],
};
