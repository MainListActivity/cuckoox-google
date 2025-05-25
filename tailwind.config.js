/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        error: 'var(--color-error)',
        warning: 'var(--color-warning)',
        info: 'var(--color-info)',
        success: 'var(--color-success)',
        'text-primary': 'var(--color-text-primary)', // Renamed from textOnBackground for clarity
        'text-secondary': 'var(--color-text-secondary)', // Renamed from textOnSurface/textHint
        'on-primary': 'var(--color-text-on-primary)',
        'on-secondary': 'var(--color-text-on-secondary)',
        'disabled': 'var(--color-text-disabled)', // Renamed from textDisabled
        'hint': 'var(--color-text-hint)',
        'border-light': 'var(--color-border-light)',
        'border-dark': 'var(--color-border-dark)',
      },
    },
  },
  plugins: [],
};
