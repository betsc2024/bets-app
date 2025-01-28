// Design tokens for the BETs application
export const tokens = {
  colors: {
    // Brand colors
    primary: {
      DEFAULT: 'hsl(277, 41%, 41%)', // #743e95
      light: 'hsl(277, 41%, 51%)',
      dark: 'hsl(277, 41%, 31%)',
      foreground: 'hsl(0, 0%, 100%)'
    },
    // Neutral colors
    background: {
      DEFAULT: 'hsl(0, 0%, 100%)',
      secondary: 'hsl(0, 0%, 98%)'
    },
    // Semantic colors
    success: {
      DEFAULT: 'hsl(142, 76%, 36%)',
      foreground: 'hsl(0, 0%, 100%)'
    },
    warning: {
      DEFAULT: 'hsl(38, 92%, 50%)',
      foreground: 'hsl(0, 0%, 100%)'
    },
    error: {
      DEFAULT: 'hsl(0, 84%, 60%)',
      foreground: 'hsl(0, 0%, 100%)'
    }
  },
  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    '2xl': '2.5rem',  // 40px
  },
  typography: {
    fonts: {
      sans: 'Inter, system-ui, sans-serif',
      mono: 'JetBrains Mono, monospace',
    },
    sizes: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem',// 30px
      '4xl': '2.25rem', // 36px
    },
    weights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    }
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  },
  radii: {
    sm: '0.25rem',    // 4px
    DEFAULT: '0.375rem', // 6px
    md: '0.5rem',     // 8px
    lg: '0.75rem',    // 12px
    full: '9999px',
  }
}
