/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          sunken: 'var(--surface-sunken)',
          raised: 'var(--surface-raised)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          muted: 'var(--ink-muted)',
          faint: 'var(--ink-faint)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        brand: {
          DEFAULT: 'var(--brand)',
          hover: 'var(--brand-hover)',
          soft: 'var(--brand-soft)',
          on: 'var(--on-brand)',
        },
        success: { DEFAULT: 'var(--success)', soft: 'var(--success-soft)' },
        warning: { DEFAULT: 'var(--warning)', soft: 'var(--warning-soft)' },
        danger:  { DEFAULT: 'var(--danger)',  soft: 'var(--danger-soft)' },
        info:    { DEFAULT: 'var(--info)',     soft: 'var(--info-soft)' },
        role: {
          admin:     { DEFAULT: 'var(--role-admin)',     soft: 'var(--role-admin-soft)' },
          volunteer: { DEFAULT: 'var(--role-volunteer)', soft: 'var(--role-volunteer-soft)' },
          parent:    { DEFAULT: 'var(--role-parent)',    soft: 'var(--role-parent-soft)' },
        },
      },
      fontFamily: {
        sans: ['"Josefin Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        slab: ['"Josefin Slab"', 'Georgia', 'serif'],
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        lg: '0.875rem',
        xl: '1.125rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      transitionTimingFunction: {
        brand: 'var(--ease)',
      },
      ringColor: {
        brand: 'var(--ring)',
      },
    },
  },
  plugins: [],
}
