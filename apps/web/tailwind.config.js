/**
 * Palette, scale and shape come from the Stitch mockups.
 *
 * Every colour resolves through a CSS variable rather than a literal hex. The
 * mockups only describe the light theme; routing through variables lets the dark
 * theme redefine the same token names in one place instead of forcing a `dark:`
 * twin onto every element.
 */

/** @type {import('tailwindcss').Config} */
const color = (name) => `rgb(var(--${name}) / <alpha-value>)`;

const SEMANTIC_COLORS = [
  'background',
  'surface',
  'surface-variant',
  'surface-bright',
  'surface-dim',
  'surface-container',
  'surface-container-lowest',
  'surface-container-low',
  'surface-container-high',
  'surface-container-highest',
  'surface-tint',
  'on-background',
  'on-surface',
  'on-surface-variant',
  'primary',
  'on-primary',
  'primary-container',
  'on-primary-container',
  'primary-fixed',
  'primary-fixed-dim',
  'secondary',
  'on-secondary',
  'secondary-container',
  'on-secondary-container',
  'secondary-fixed',
  'secondary-fixed-dim',
  'tertiary',
  'on-tertiary',
  'tertiary-container',
  'on-tertiary-container',
  'error',
  'on-error',
  'error-container',
  'on-error-container',
  'success',
  'outline',
  'outline-variant',
  'inverse-surface',
  'inverse-on-surface',
  'inverse-primary',
];

export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: Object.fromEntries(SEMANTIC_COLORS.map((name) => [name, color(name)])),
      borderRadius: {
        DEFAULT: '0.125rem',
        lg: '0.25rem',
        xl: '0.5rem',
        '4xl': '2rem',
        full: '0.75rem',
        circle: '9999px',
      },
      spacing: {
        gutter: '16px',
        base: '4px',
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        'row-height': '44px',
        sidebar: '240px',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        'label-caps': ['11px', { lineHeight: '16px', letterSpacing: '0.04em', fontWeight: '600' }],
        'body-sm': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        'data-table-cell': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        'body-md': ['15px', { lineHeight: '22px', fontWeight: '400' }],
        'body-lg': ['17px', { lineHeight: '24px', fontWeight: '400' }],
        'headline-sm': ['17px', { lineHeight: '24px', fontWeight: '700' }],
        'headline-md': ['22px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-lg': ['28px', { lineHeight: '34px', letterSpacing: '-0.02em', fontWeight: '600' }],
      },
      keyframes: {
        // A highlight that travels left to right across a placeholder or a bar.
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        // A ring that grows and fades out of a status dot while work is running.
        ping: {
          '75%, 100%': { transform: 'scale(2.4)', opacity: '0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.8s ease-in-out infinite',
        'ping-slow': 'ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      boxShadow: {
        sm: '0 1px 2px rgb(0 0 0 / 0.05)',
        md: '0 2px 8px rgb(0 0 0 / 0.07)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')({ strategy: 'class' })],
};
