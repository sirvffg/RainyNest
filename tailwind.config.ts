import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './scripts/themes/**/templates/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary, #3b82f6)',
          hover: 'var(--color-primary-hover, #2563eb)',
        },
        bg: {
          DEFAULT: 'var(--color-bg, #ffffff)',
          secondary: 'var(--color-bg-secondary, #f8fafc)',
        },
        fg: {
          DEFAULT: 'var(--color-fg, #0f172a)',
          muted: 'var(--color-fg-muted, #64748b)',
        },
        line: 'var(--color-border, #e2e8f0)',
      },
      borderRadius: {
        sm: 'var(--radius-sm, 4px)',
        DEFAULT: 'var(--radius-md, 8px)',
        lg: 'var(--radius-lg, 12px)',
      },
      fontFamily: {
        sans: ['var(--font-sans, system-ui)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono, ui-monospace)', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-down': {
          from: { opacity: '0', transform: 'translateY(-16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        'fade-in-up': 'fade-in-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in-down': 'fade-in-down 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-out': 'fade-out 0.3s ease-in both',
        'scale-in': 'scale-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in-left': 'slide-in-left 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
