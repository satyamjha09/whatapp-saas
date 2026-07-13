export const metaWhatTheme = {
  colors: {
    background: "#E7F8EF",
    border: "#BFE9D0",
    muted: "#526173",
    navy: "#081B3A",
    primary: "#128C7E",
    primaryHover: "#075E54",
    surface: "#FFFFFF",
    text: "#102040",
  },
  radius: {
    control: "0.75rem",
    panel: "1rem",
    shell: "1.25rem",
  },
  shadow: {
    panel: "0 16px 40px rgba(8, 27, 58, 0.08)",
    raised: "0 18px 44px rgba(8, 27, 58, 0.10)",
  },
} as const;

export const metaWhatFocusRing =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#128C7E]/15 focus-visible:ring-offset-0";
