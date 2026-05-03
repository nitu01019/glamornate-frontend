import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/components/**/*.{js,ts,jsx,tsx,mdx}', './src/app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        'section-bg': 'hsl(var(--section-bg))',
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        // Glamornate Brand Colors — Yes Madam-inspired palette
        brand: {
          // Deep Maroon/Berry primary scale centered on #880E4F
          maroon: {
            50: '#FDF2F8',
            100: '#FCE7F3',
            200: '#FBCFE8',
            300: '#F9A8D4',
            400: '#C2185B',
            500: '#880E4F',
            600: '#7B0C47',
            700: '#6D0A3E',
            800: '#5E0835',
            900: '#4A062A',
            950: '#2D0419',
          },
          // Gold/Amber scale centered on #FFD700
          gold: {
            50: '#FFFEF0',
            100: '#FEFCE8',
            200: '#FEF9C3',
            300: '#FEF08A',
            400: '#FDE047',
            500: '#FFD700',
            600: '#EAB308',
            700: '#CA8A04',
            800: '#A16207',
            900: '#854D0E',
            950: '#422006',
          },
          // Green for discounts & View Cart
          green: {
            50: '#F0FDF4',
            100: '#DCFCE7',
            200: '#BBF7D0',
            300: '#86EFAC',
            400: '#4ADE80',
            500: '#22C55E',
            600: '#16A34A',
            700: '#15803D',
            800: '#166534',
            900: '#14532D',
            950: '#052E16',
          },
          // Warm neutral cream scale for premium surfaces
          cream: { 50: '#FFF8F2', 100: '#FFEFE2' },
          // Peach accent for category tiles
          peach: { 50: '#FFF1E9', 100: '#FFE1D0' },
          // Blush Premium pink palette — soft-pink category tiles +
          // curtain-reveal wash. All body-text stops (50/100/200/300)
          // pass WCAG AA against Gray-800 (#1F2937) at >= 4.5:1.
          // See docs/plans/investigations/round3/p1-a3-pink-tokens.md.
          pink: {
            50: '#FFF1F4',
            100: '#FFE1E7',
            200: '#FBC5D0',
            300: '#F29BB0',
          },
          // Premium-tier accent — white text only (5.03:1 vs white).
          // Never use as a body-text surface.
          blush: {
            500: '#D94674',
          },
          // Elite tier dark maroon background + gold text
          eliteBg: '#2D0419',
          eliteText: '#FFD700',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        card: '0.75rem',
        'card-lg': '1rem',
        pill: '9999px',
        tile: '1.1rem',
      },
      boxShadow: {
        'card-sm': '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-md': '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        'card-lg': '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
        'card-hover': '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.06)',
        maroon: '0 4px 14px 0 rgba(136, 14, 79, 0.15)',
        'maroon-lg': '0 10px 40px -10px rgba(136, 14, 79, 0.3)',
        gold: '0 4px 14px 0 rgba(255, 215, 0, 0.2)',
        'float-btn': '0 4px 12px 0 rgba(22, 163, 74, 0.3)',
        'tile-sm': '0 1px 2px 0 rgba(136,14,79,0.04), 0 1px 3px 0 rgba(136,14,79,0.06)',
        'tile-md': '0 2px 6px 0 rgba(136,14,79,0.08), 0 4px 10px -2px rgba(136,14,79,0.08)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-from-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-in-from-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'marquee-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '15%': { transform: 'translateY(0)', opacity: '1' },
          '85%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-100%)', opacity: '0' },
        },
        'curtain-up': {
          '0%': { clipPath: 'inset(0 0 0 0)', opacity: '1' },
          '55%': { clipPath: 'inset(0 0 0 0)', opacity: '1' },
          '95%': { clipPath: 'inset(100% 0 0 0)', opacity: '1' },
          '100%': { clipPath: 'inset(100% 0 0 0)', opacity: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.5s ease-out',
        'fade-in-up': 'fade-in-up 0.5s ease-out',
        'slide-in-left': 'slide-in-from-left 0.3s ease-out',
        'slide-in-right': 'slide-in-from-right 0.3s ease-out',
        'slide-up': 'slide-up 0.5s ease-out forwards',
        'scale-in': 'scale-in 0.3s ease-out forwards',
        shimmer: 'shimmer 2s infinite',
        float: 'float 3s ease-in-out infinite',
        'marquee-up': 'marquee-up 3s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'curtain-up': 'curtain-up 4.5s cubic-bezier(0.85, 0, 0.15, 1) infinite',
      },
    },
  },
  plugins: [animate],
};

export default config;
