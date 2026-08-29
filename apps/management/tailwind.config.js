import { colors, typography, borderRadius } from '@cullinos/ui';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: colors.brand,
        bg: colors.background,
        text: colors.text,
        status: colors.status,
        table: colors.table,
      },
      fontFamily: typography.fontFamily,
      borderRadius,
    },
  },
};
