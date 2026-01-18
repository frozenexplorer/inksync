export type TextFontOption = {
  id: string;
  label: string;
  family: string;
};

export const TEXT_FONTS: TextFontOption[] = [
  { id: "outfit", label: "Outfit", family: "'Outfit', sans-serif" },
  { id: "playfair", label: "Playfair", family: "'Playfair Display', serif" },
  { id: "space-grotesk", label: "Space Grotesk", family: "'Space Grotesk', sans-serif" },
  { id: "jetbrains-mono", label: "JetBrains Mono", family: "'JetBrains Mono', monospace" },
];

export const DEFAULT_TEXT_FONT_FAMILY = TEXT_FONTS[0].family;

export const TEXT_SIZE_RANGE = {
  min: 10,
  max: 96,
  step: 1,
};

export function clampTextSize(size: number): number {
  return Math.min(TEXT_SIZE_RANGE.max, Math.max(TEXT_SIZE_RANGE.min, Math.round(size)));
}
