/**
 * PerkOS Stack Theme Configuration - "Neon Dusk"
 * ===============================================
 * Centralized theme values for programmatic access.
 * CSS variables are defined in app/globals.css
 *
 * To change the theme:
 * 1. Update CSS variables in globals.css (for Tailwind/CSS usage)
 * 2. Update hex values here (for JS/third-party library usage)
 *
 * Neon Dusk Color Palette:
 * - Primary: Vibrant Pink (#EB1B69) - Actions, links, focus states
 * - Secondary: Orange (#FD8F50) - Secondary actions, highlights
 * - Accent: Coral (#EF5B57) - Accents, notifications
 * - Background: Deep Purple-Black (#0E0716) - Page backgrounds
 * - Surface: Dark Navy-Purple (#1B1833) - Card backgrounds
 * - Highlight: Peach (#FAB46C) - Text highlights, success states
 */

// ===========================================
// CORE COLOR PALETTE - Neon Dusk (Hex values)
// ===========================================

export const colors = {
  // Purple scale (backgrounds, borders) - Deep to light
  purple: {
    950: '#0E0716',  // Deepest background
    900: '#1B1833',  // Surface/card background
    800: '#45193C',  // Card/popover
    700: '#8E2051',  // Borders, hover states
    600: '#76437B',  // Muted elements
    500: '#EB1B69',  // Primary pink
  },

  // Warm scale (text, accents) - Peach to coral
  warm: {
    100: '#FFF5EB',  // Lightest peach
    200: '#FFE4CC',  // Light peach
    300: '#FAB46C',  // Peach - highlight, text secondary
    400: '#FD8F50',  // Orange - secondary
    500: '#EF5B57',  // Coral - accent
    600: '#EB1B69',  // Vibrant pink - primary
  },

  // Pink scale (primary actions)
  pink: {
    300: '#F472B6',  // Light pink
    400: '#EC4899',  // Medium pink
    500: '#EB1B69',  // Primary vibrant pink
    600: '#BE185D',  // Dark pink
    700: '#9D174D',  // Darker pink
  },

  // Orange scale (secondary actions)
  orange: {
    300: '#FDBA74',  // Light orange
    400: '#FD8F50',  // Orange - secondary
    500: '#F97316',  // Medium orange
    600: '#EA580C',  // Dark orange
  },

  // Coral scale (accent)
  coral: {
    300: '#FDA4AF',  // Light coral
    400: '#EF5B57',  // Coral - accent
    500: '#E11D48',  // Medium coral
    600: '#BE123C',  // Dark coral
  },

  // Peach scale (highlights, text)
  peach: {
    200: '#FFE4CC',  // Light peach
    300: '#FAB46C',  // Peach - highlight
    400: '#FB923C',  // Medium peach
    500: '#F97316',  // Dark peach
  },

  // Green scale (success) - kept for semantic use
  green: {
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
  },

  // Yellow scale (warning)
  yellow: {
    400: '#facc15',
    500: '#eab308',
  },

  // Red scale (error/destructive) - using coral
  red: {
    400: '#F87171',
    500: '#EF5B57',
    600: '#DC2626',
  },

  // Base colors
  white: '#FFFFFF',
  black: '#000000',
} as const;

// Legacy aliases for backward compatibility
export const slate = colors.purple;
export const gray = {
  100: colors.white,
  200: '#E5E7EB',
  300: '#D1D5DB',
  400: colors.warm[300],  // Peach for muted text
  500: colors.purple[600],
  600: colors.purple[700],
};

// ===========================================
// SEMANTIC COLOR TOKENS - Neon Dusk
// ===========================================

export const semanticColors = {
  // Backgrounds
  background: {
    page: colors.purple[950],     // #0E0716 - Deep purple-black
    card: colors.purple[900],     // #1B1833 - Dark navy-purple
    cardHover: colors.purple[800], // #45193C - Dark purple
    popover: colors.purple[800],  // #45193C - Dark purple
    input: colors.purple[700],    // #8E2051 - Maroon purple
    muted: colors.purple[600],    // #76437B - Dusty purple
  },

  // Text
  text: {
    primary: colors.white,        // #FFFFFF - White
    secondary: colors.warm[300],  // #FAB46C - Peach
    muted: colors.purple[600],    // #76437B - Dusty purple
    subtle: colors.warm[200],     // Light peach
    inverted: colors.purple[950], // #0E0716 - Dark on light
    accent: colors.warm[400],     // #FD8F50 - Orange
    error: colors.coral[400],     // #EF5B57 - Coral
  },

  // Borders
  border: {
    default: colors.purple[700],  // #8E2051 - Maroon purple
    muted: colors.purple[800],    // #45193C - Dark purple
    focus: colors.pink[500],      // #EB1B69 - Vibrant pink
    accent: colors.coral[400],    // #EF5B57 - Coral
  },

  // Actions
  action: {
    primary: colors.pink[500],    // #EB1B69 - Vibrant pink
    primaryHover: colors.pink[400], // Medium pink
    accent: colors.orange[400],   // #FD8F50 - Orange
    accentHover: colors.orange[300], // Light orange
    destructive: colors.coral[400], // #EF5B57 - Coral
    destructiveHover: colors.coral[300], // Light coral
  },

  // Status
  status: {
    success: colors.green[500],
    warning: colors.yellow[500],
    error: colors.coral[400],     // #EF5B57 - Coral
    info: colors.pink[500],       // #EB1B69 - Vibrant pink
  },
} as const;

// ===========================================
// GRADIENT DEFINITIONS - Neon Dusk
// ===========================================

export const gradients = {
  primary: `linear-gradient(135deg, ${colors.pink[500]}, ${colors.orange[400]})`,
  primaryHover: `linear-gradient(135deg, ${colors.pink[400]}, ${colors.orange[300]})`,
  accent: `linear-gradient(135deg, ${colors.coral[400]}, ${colors.peach[300]})`,
  purple: `linear-gradient(135deg, ${colors.purple[700]}, ${colors.pink[500]})`,
  sunset: `linear-gradient(135deg, ${colors.pink[500]}, ${colors.orange[400]}, ${colors.peach[300]})`,
  dusk: `linear-gradient(180deg, ${colors.purple[950]}, ${colors.purple[900]})`,
  success: `linear-gradient(to right, ${colors.green[500]}, ${colors.peach[300]})`,
} as const;

// ===========================================
// PARA MODAL THEME (Third-party integration)
// ===========================================

export const paraModalTheme = {
  backgroundColor: colors.purple[900],    // #1B1833 - Surface
  foregroundColor: colors.white,          // #FFFFFF - White text
  accentColor: colors.pink[500],          // #EB1B69 - Vibrant pink
  mode: 'dark' as const,
  borderRadius: 'md' as const,
  customPalette: {
    text: {
      primary: colors.white,              // #FFFFFF
      secondary: colors.warm[300],        // #FAB46C - Peach
      subtle: colors.purple[600],         // #76437B - Muted
      inverted: colors.purple[950],       // #0E0716
      error: colors.coral[400],           // #EF5B57
    },
    modal: {
      surface: {
        main: colors.purple[950],         // #0E0716 - Deepest background
        footer: colors.purple[900],       // #1B1833 - Surface
      },
      border: colors.purple[700],         // #8E2051 - Maroon purple
    },
  },
};

// ===========================================
// CHART COLORS - Neon Dusk
// ===========================================

export const chartColors = [
  colors.pink[500],    // #EB1B69 - Vibrant pink (primary)
  colors.orange[400],  // #FD8F50 - Orange (secondary)
  colors.coral[400],   // #EF5B57 - Coral (accent)
  colors.peach[300],   // #FAB46C - Peach (highlight)
  colors.purple[600],  // #76437B - Dusty purple (muted)
  colors.green[500],   // Green (success)
] as const;

// ===========================================
// TYPOGRAPHY (if needed for consistency)
// ===========================================

export const typography = {
  fontFamily: {
    sans: 'var(--font-inter), system-ui, -apple-system, sans-serif',
    mono: 'var(--font-mono), Menlo, Monaco, monospace',
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
} as const;

// ===========================================
// SPACING & SIZING (if needed)
// ===========================================

export const spacing = {
  radius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
} as const;

// ===========================================
// EXPORT DEFAULT THEME OBJECT
// ===========================================

const theme = {
  colors,
  semanticColors,
  gradients,
  chartColors,
  typography,
  spacing,
  // Third-party integrations
  para: paraModalTheme,
} as const;

export default theme;

// Type exports for TypeScript support
export type Colors = typeof colors;
export type SemanticColors = typeof semanticColors;
export type Gradients = typeof gradients;
export type Theme = typeof theme;
