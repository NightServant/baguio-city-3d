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
 * Colour values are the hex equivalents of the oklch tokens in globals.css.
 * Keep the two in step: Tailwind reads the CSS variables, MUI reads these.
 */

const WARP = "#16130F"; // warm near-black
const BONE = "#F5F0E6"; // undyed cotton ground
const ECRU = "#E8DFD0"; // woven mid
const MADDER = "#8C2318"; // the single accent
const MADDER_LT = "#B5432F";
const MUTED = "#6B6156";
const BORDER = "#D8CEBC";

export const theme = createTheme({
  cssVariables: true,
  shape: {
    // Square. The identity is woven, not rounded.
    borderRadius: 2,
  },
  // Material's elevation system does not exist here: every level is flat.
  shadows: Array(25).fill("none") as unknown as ReturnType<
    typeof createTheme
  >["shadows"],
  palette: {
    mode: "light",
    primary: { main: MADDER, light: MADDER_LT, dark: "#6E1B12", contrastText: BONE },
    secondary: { main: WARP, contrastText: BONE },
    background: { default: BONE, paper: "#FDFBF6" },
    text: { primary: WARP, secondary: MUTED },
    divider: BORDER,
    error: { main: "#A32A1E" },
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
          borderColor: BORDER,
          color: WARP,
          "&:hover": { borderColor: WARP, backgroundColor: ECRU },
        },
        contained: {
          "&:hover": { backgroundColor: "#6E1B12" },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: BONE,
          backgroundImage: "none",
          borderLeft: `1px solid ${BORDER}`,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none", border: `1px solid ${BORDER}` },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 2 } },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: WARP, color: BONE, borderRadius: 2, fontSize: "0.75rem" },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        // Tailwind owns layout and the weave utilities; MUI must not reset
        // the body colours out from under it.
        body: { backgroundColor: BONE, color: WARP },
      },
    },
  },
});
