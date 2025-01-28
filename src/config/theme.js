export const themeConfig = {
  colors: {
    primary: '#743e95',
    white: '#FFFFFF',
    // Add more colors as needed
  },
  assets: {
    logo: '/assets/BEtS-Logo.svg',
    favicon: '/favicon.ico'
  },
  // Add more configuration as needed
}

// Convert hex to hsl for tailwind
export const colors = {
  primary: {
    DEFAULT: 'hsl(277, 41%, 41%)', // #743e95
    foreground: 'hsl(0, 0%, 100%)' // white
  },
  // Add more color variations if needed
}
