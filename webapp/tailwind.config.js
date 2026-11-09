/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--paper) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        raised: 'rgb(var(--raised) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        brand: 'rgb(var(--brand) / <alpha-value>)',
        'brand-ink': 'rgb(var(--brand-ink) / <alpha-value>)',
        risk: 'rgb(var(--risk) / <alpha-value>)',
        warn: 'rgb(var(--warn) / <alpha-value>)',
        safe: 'rgb(var(--safe) / <alpha-value>)',
        gold: 'rgb(var(--gold) / <alpha-value>)',
        'pol-conv': 'rgb(var(--pol-conv) / <alpha-value>)',
        'pol-v1': 'rgb(var(--pol-v1) / <alpha-value>)',
        'pol-v2': 'rgb(var(--pol-v2) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"Red Hat Text Variable"', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Red Hat Display Variable"', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"Red Hat Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      // tighter corners than the Tailwind defaults: cards and inputs read as instruments, not bubbles
      borderRadius: { lg: '0.375rem', xl: '0.5rem', '2xl': '0.625rem', '3xl': '0.75rem', xl2: '0.625rem' },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / 0.05)',
        lift: '0 2px 4px rgb(var(--shadow) / 0.06), 0 12px 28px -14px rgb(var(--shadow) / 0.28)',
      },
      maxWidth: { page: '76rem' },
    },
  },
  plugins: [],
};
