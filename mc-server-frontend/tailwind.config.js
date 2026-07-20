/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navbar: '#3B1F8C',
        logobox: '#2d1b69',
        bg: {
          page:    '#0f0f1a',
          app:     '#1a1a2e',
          surface: '#1a1a2e',
          card:    '#1a1a2e',
          input:   '#0f0f1a',
          inner:   '#0f0f1a',
        },
        primary: {
          tint:   '#2d1b69',
          base:   '#4C1D95',
          btn:    '#4C1D95',
          border: '#7C3AED',
          purple: '#A78BFA',
          text:   '#A78BFA',
        },
        success: {
          bg:     '#052E16',
          border: '#059669',
          text:   '#6EE7B7',
        },
        danger: {
          bg:     '#450A0A',
          border: '#DC2626',
          text:   '#FCA5A5',
        },
        warning: {
          bg:     '#78350F',
          border: '#D97706',
          text:   '#FDE68A',
        },
        text: {
          heading:     '#FFFFFF',
          body:        '#E0E0E0',
          muted:       'rgba(255, 255, 255, 0.4)',
          placeholder: 'rgba(255, 255, 255, 0.3)',
        },
        border: {
          default: '#2A2A3A',
          subtle:  '#2A2A3A',
          active:  '#7C3AED',
        },
      },
    },
  },
  plugins: [],
}
