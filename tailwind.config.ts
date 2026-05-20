import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1480px",
      },
    },
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        nexus: {
          cyan: "#20f6ff",
          blue: "#2b8cff",
          violet: "#8a7bff",
          graphite: "#0b1018",
          steel: "#17202d",
          ember: "#ffb454",
          good: "#4bf4a8",
          danger: "#ff5f7a",
        },
      },
      boxShadow: {
        glow: "0 0 30px rgba(32, 246, 255, 0.25)",
        "glow-blue": "0 0 45px rgba(43, 140, 255, 0.28)",
        panel: "0 24px 80px rgba(0, 0, 0, 0.45)",
      },
      backgroundImage: {
        "scan-lines": "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(120%)" },
        },
        pulseRing: {
          "0%, 100%": { opacity: "0.4", transform: "scale(0.98)" },
          "50%": { opacity: "0.85", transform: "scale(1.02)" },
        },
      },
      animation: {
        shimmer: "shimmer 2.8s ease-in-out infinite",
        "pulse-ring": "pulseRing 3s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
