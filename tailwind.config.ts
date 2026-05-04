import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        owlaris: {
          primary:   '#6C3FC5', // púrpura principal
          secondary: '#4ECDC4', // teal acento
          dark:      '#1A1A2E', // fondo oscuro
          light:     '#F8F7FF', // fondo claro
          success:   '#2ECC71',
          warning:   '#F39C12',
          danger:    '#E74C3C',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      }
    },
  },
  plugins: [],
}

export default config
