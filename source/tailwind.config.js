/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        raised: 'rgb(var(--raised) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        mute: 'rgb(var(--mute) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        done: 'rgb(var(--done) / <alpha-value>)',
        warm: 'rgb(var(--warm) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        gold: 'rgb(var(--gold) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Barlow', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Barlow Condensed"', 'Barlow', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
