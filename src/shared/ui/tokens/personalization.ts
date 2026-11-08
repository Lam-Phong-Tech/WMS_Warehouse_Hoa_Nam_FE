import { OPERATIONS_COLORS } from "./operations";
export type PersonalAccentName = "ocean" | "teal" | "indigo" | "graphite";
const CUSTOM_ACCENTS = {
  teal: {
    light: {
      primary: "#006D77",
      primaryHover: "#00535B",
      link: "#006D77",
      pale: "#E4F2F2",
      tableHeader: "#D3EBEC",
    },
    dark: {
      primary: "#087F8C",
      primaryHover: "#006A75",
      link: "#70D9DC",
      pale: "#1D3C43",
      tableHeader: "#24434A",
    },
  },
  indigo: {
    light: {
      primary: "#4054A8",
      primaryHover: "#304184",
      link: "#4054A8",
      pale: "#EEF0FB",
      tableHeader: "#DEE3F7",
    },
    dark: {
      primary: "#465CB6",
      primaryHover: "#3A4E9F",
      link: "#AEbDFC",
      pale: "#283550",
      tableHeader: "#303E5D",
    },
  },
  graphite: {
    light: {
      primary: "#364152",
      primaryHover: "#263240",
      link: "#364152",
      pale: "#EDF0F3",
      tableHeader: "#DFE5EC",
    },
    dark: {
      primary: "#52657C",
      primaryHover: "#43556A",
      link: "#BFD0E1",
      pale: "#293B4C",
      tableHeader: "#304458",
    },
  },
} as const;
export function personalAccent(
  mode: "light" | "dark",
  accent: PersonalAccentName = "ocean",
) {
  if (accent !== "ocean") return CUSTOM_ACCENTS[accent][mode];
  const base = OPERATIONS_COLORS[mode];
  return {
    primary: base.primary,
    primaryHover: base.primaryHover,
    link: base.link,
    pale: base.pale,
    tableHeader: base.tableHeader,
  };
}
export const PERSONAL_FONT_SIZE = { small: 13, medium: 14, large: 16 } as const;
