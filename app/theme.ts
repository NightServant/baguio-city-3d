"use client";

import { createTheme } from "@mui/material/styles";

/**
 * Material UI, retuned to the "Cordillera Weave" identity.
 *
 * Material Design's defaults — elevation shadows, ripples, Roboto, rounded
 * corners — are the opposite of this identity, which is flat, hard-edged and
 * woven. So the overrides below are not cosmetic: they switch those defaults
 * off at the theme level, once, so individual call sites don't have to.
 *
 * Palette values are the hex equivalents of the tokens in globals.css, light
 * and dark. Keep the two in step: Tailwind reads the CSS variables, MUI reads
 * these. Component overrides use the CSS variables directly, so they follow
 * the visitor's colour scheme with no second set of values.
 */

const WARP = "#16130F"; // warm near-black
const BONE = "#F5F0E6"; // undyed cotton ground
const MADDER = "#8C2318"; // the single accent
const MADDER_LT = "#B5432F";
const MUTED = "#6B6156";
const BORDER = "#D8CEBC";

// Dark: ube ground, bone warp, madder lifted to read on ube.
const UBE = "#261b30";
const UBE_CARD = "#2f223c";
const BONE_DK = "#f3ece1";
const MADDER_DK = "#ff7a68";
const MUTED_DK = "#c1b5d0";
const BORDER_DK = "#54416a";

export const theme = createTheme({
  // Same switch as globals.css: data-theme on <html>, set by InitColorSchemeScript.
  cssVariables: { colorSchemeSelector: "[data-theme='%s']" },
  shape: {
    // Square. The identity is woven, not rounded.
    borderRadius: 2,
  },
  // Material's elevation system does not exist here: every level is flat.
  shadows: Array(25).fill("none") as unknown as ReturnType<
    typeof createTheme
  >["shadows"],
  colorSchemes: {
    light: {
      palette: {
        primary: { main: MADDER, light: MADDER_LT, dark: "#6E1B12", contrastText: BONE },
        secondary: { main: WARP, contrastText: BONE },
        background: { default: BONE, paper: "#FDFBF6" },
        text: { primary: WARP, secondary: MUTED },
        divider: BORDER,
        error: { main: "#A32A1E" },
      },
    },
    dark: {
      palette: {
        primary: { main: MADDER_DK, light: "#ff9483", dark: MADDER_LT, contrastText: UBE },
        secondary: { main: BONE_DK, contrastText: UBE },
        background: { default: UBE, paper: UBE_CARD },
        text: { primary: BONE_DK, secondary: MUTED_DK },
        divider: BORDER_DK,
        error: { main: "#ff8a78" },
      },
    },
  },
  typography: {
    // One family, as in globals.css. The variable width axis does the work
    // that a second display face would normally do.
    fontFamily: "var(--font-sans), system-ui, sans-serif",
    button: { textTransform: "none", fontWeight: 600, letterSpacing: 0 },
    h1: { fontVariationSettings: '"wdth" 125', fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 0.9 },
    h2: { fontVariationSettings: '"wdth" 125', fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.02 },
    h3: { fontVariationSettings: '"wdth" 118', fontWeight: 700, letterSpacing: "-0.02em" },
    h4: { fontVariationSettings: '"wdth" 112', fontWeight: 700, letterSpacing: "-0.015em" },
  },
  components: {
    MuiButtonBase: {
      // No ripple: Material's touch feedback reads as a different product.
      defaultProps: { disableRipple: true },
      styleOverrides: {
        // ButtonBase sets outline: 0 and the ripple (removed above) was the
        // only other focus indicator, so keyboard focus was invisible
        // (WCAG 2.4.7) without this.
        root: {
          "&.Mui-focusVisible": { outline: "2px solid var(--ring)", outlineOffset: 2 },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true, variant: "contained" },
      styleOverrides: {
        root: {
          borderRadius: 2,
          paddingInline: "1.5rem",
          transition: "background-color 120ms ease, color 120ms ease",
        },
        outlined: {
          borderColor: "var(--border)",
          color: "var(--foreground)",
          "&:hover": { borderColor: "var(--foreground)", backgroundColor: "var(--secondary)" },
        },
        contained: {
          "&:hover": { backgroundColor: "var(--primary-hover)" },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: "var(--background)",
          backgroundImage: "none",
          borderLeft: "1px solid var(--border)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none", border: "1px solid var(--border)" },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 2 } },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "var(--foreground)",
          color: "var(--background)",
          borderRadius: 2,
          fontSize: "0.75rem",
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        // Tailwind owns layout and the weave utilities; MUI must not reset
        // the body colours out from under it.
        body: { backgroundColor: "var(--background)", color: "var(--foreground)" },
      },
    },
  },
});
