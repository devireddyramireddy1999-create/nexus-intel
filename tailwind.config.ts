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
          champagne: "#D8C27A",
          gold: "#C9A646",
          bronze: "#5C4820",
          violet: "#8A6A2A",
          graphite: "#080808",
          steel: "#14120E",
          ember: "#C9A646",
          good: "#4bf4a8",
          danger: "#ff5f7a",
        },
      },
      boxShadow: {
        glow: "0 0 28px rgba(201, 166, 70, 0.18)",
        "glow-blue": "0 0 44px rgba(201, 166, 70, 0.16)",
        panel: "0 24px 80px rgba(0, 0, 0, 0.58)",
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
