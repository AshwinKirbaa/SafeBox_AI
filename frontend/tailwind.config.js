/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-0': '#05070D',
        'bg-1': '#0A1022',
        'bg-2': '#121826',
        'bg-3': '#1A2236',
        'border-hairline': 'rgba(148, 163, 184, 0.14)',
        'text-1': '#E6EBF5',
        'text-2': '#9AA6BD',
        'accent-cyan': '#22D3EE',
        'accent-blue': '#3B82F6',
        'severity-ok': '#34D399',
        'severity-warn': '#FBBF24',
        'severity-danger': '#F87171',
        'severity-critical': '#FB7185',
      },
      fontFamily: {
        heading: ['Sora', 'Inter', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        'input': '8px',
        'card': '14px',
        'hero': '24px',
      },
      boxShadow: {
        'vault-glow': '0 0 35px -5px rgba(34, 211, 238, 0.25)',
        'cyan-sm': '0 0 15px -3px rgba(34, 211, 238, 0.3)',
        'card-elevated': '0 8px 30px rgba(0, 0, 0, 0.5), 0 1px 0 rgba(255, 255, 255, 0.08) inset',
      }
    },
  },
  plugins: [],
}
