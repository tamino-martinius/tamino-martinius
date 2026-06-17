export interface Theme {
  name: "light" | "dark";
  background: string;
  cardBorder: string;
  foreground: string;
  foregroundLight: string;
  empty: string;
  green: string;
  blue: string;
  red: string;
  series: string[]; // color-1 .. color-13
}

// color-1 .. color-13 from metrics src/style/index.css (color-0 #d4dae1 is the empty/track color).
const SERIES = [
  "#673bd6",
  "#535ae0",
  "#3f77e9",
  "#2c96f2",
  "#34adf0",
  "#56bce1",
  "#7accd4",
  "#9ddbc6",
  "#d5efe4",
  "#dddae4",
  "#e5aed4",
  "#e986b4",
  "#ff8585",
];

export const themes: Record<"light" | "dark", Theme> = {
  light: {
    name: "light",
    background: "#ffffff",
    cardBorder: "#f2f4f6",
    foreground: "#22272e",
    foregroundLight: "#627386",
    empty: "#f4faff",
    green: "#00d559",
    blue: "#00a5fe",
    red: "#f05033",
    series: SERIES,
  },
  dark: {
    name: "dark",
    background: "#161b22",
    cardBorder: "#30363d",
    foreground: "#e6edf3",
    foregroundLight: "#9aa7b4",
    empty: "#21262d",
    green: "#00d559",
    blue: "#00a5fe",
    red: "#f05033",
    series: SERIES,
  },
};
