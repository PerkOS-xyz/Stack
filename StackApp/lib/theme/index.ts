/**
 * PerkOS Stack Theme Configuration
 * =================================
 * Centralized theme values for programmatic access.
 * CSS variables are defined in app/globals.css
 *
 * To change the theme:
 * 1. Update CSS variables in globals.css (for Tailwind/CSS usage)
 * 2. Update hex values here (for JS/third-party library usage)
 *
 * Color Palette:
 * - Primary: Blue (#3B82F6) - Actions, links, focus states
 * - Accent: Cyan (#22D3EE) - Highlights, success states
 * - Background: Slate shades - Page and card backgrounds
 * - Text: Gray/White shades - Content hierarchy
 */

// ===========================================
// CORE COLOR PALETTE (Hex values)
// ===========================================

export const colors = {
  // Slate scale (backgrounds, borders)
  slate: {
    950: '#0a0e17',
    900: '#0f172a',
    800: '#1e293b',
    700: '#334155',
    600: '#475569',
    500: '#64748b',
  },

  // Gray scale (text)
  gray: {
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
  },

  // Blue scale (primary actions)
  blue: {
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
  },

  // Cyan scale (accent/highlight)
  cyan: {
    300: '#67e8f9',
    400: '#22d3ee',
    500: '#06b6d4',
    600: '#0891b2',
  },

  // Green scale (success)
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

  // Red scale (error/destructive)
  red: {
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
  },

  // Purple scale (special states)
  purple: {
    500: '#a855f7',
    600: '#9333ea',
  },

  // Base colors
  white: '#ffffff',
  black: '#000000',
} as const;

// ===========================================
// SEMANTIC COLOR TOKENS
// ===========================================

export const semanticColors = {
  // Backgrounds
  background: {
    page: colors.slate[950],
    card: colors.slate[900],
    cardHover: colors.slate[800],
    popover: colors.slate[900],
    input: colors.slate[800],
    muted: colors.slate[800],
  },

  // Text
  text: {
    primary: colors.white,
    secondary: colors.gray[300],
    muted: colors.gray[400],
    subtle: colors.gray[500],
    inverted: colors.slate[900],
    accent: colors.cyan[400],
    error: colors.red[500],
  },

  // Borders
  border: {
    default: colors.slate[700],
    muted: colors.slate[800],
    focus: colors.blue[500],
    accent: colors.cyan[500],
  },

  // Actions
  action: {
    primary: colors.blue[500],
    primaryHover: colors.blue[400],
    accent: colors.cyan[500],
    accentHover: colors.cyan[400],
    destructive: colors.red[500],
    destructiveHover: colors.red[400],
  },

  // Status
  status: {
    success: colors.green[500],
    warning: colors.yellow[500],
    error: colors.red[500],
    info: colors.blue[500],
  },
} as const;

// ===========================================
// GRADIENT DEFINITIONS
// ===========================================

export const gradients = {
  primary: `linear-gradient(to right, ${colors.blue[500]}, ${colors.cyan[500]})`,
  primaryHover: `linear-gradient(to right, ${colors.blue[400]}, ${colors.cyan[400]})`,
  accent: `linear-gradient(to right, ${colors.cyan[500]}, ${colors.green[500]})`,
  purple: `linear-gradient(to right, ${colors.purple[600]}, #ec4899)`,
  success: `linear-gradient(to right, ${colors.green[500]}, ${colors.cyan[500]})`,
} as const;

// ===========================================
// PARA MODAL THEME (Third-party integration)
// ===========================================

export const paraModalTheme = {
  backgroundColor: colors.slate[800],
  foregroundColor: colors.gray[100],
  accentColor: colors.blue[500],
  mode: 'dark' as const,
  borderRadius: 'md' as const,
  customPalette: {
    text: {
      primary: colors.gray[100],
      secondary: colors.gray[300],
      subtle: colors.gray[400],
      inverted: colors.slate[900],
      error: colors.red[500],
    },
    modal: {
      surface: {
        main: colors.slate[950],
        footer: colors.slate[900],
      },
      border: colors.slate[700],
    },
  },
};

// ===========================================
// CHART COLORS
// ===========================================

export const chartColors = [
  colors.blue[500],
  colors.cyan[500],
  colors.green[500],
  colors.yellow[500],
  colors.purple[500],
  colors.red[500],
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
