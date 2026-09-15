export type BuiltinSticker = {
  id: string;
  title: string;
  src: string;
};

function svgData(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const BUILTIN_STICKERS: BuiltinSticker[] = [
  {
    id: "cash",
    title: "Cash",
    src: svgData(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect x="8" y="18" width="64" height="40" rx="6" fill="#22C55E"/><rect x="14" y="24" width="52" height="28" rx="4" fill="#86EFAC"/><circle cx="40" cy="38" r="10" fill="#166534"/><text x="40" y="43" text-anchor="middle" font-size="14" font-family="Arial" fill="#86EFAC" font-weight="700">$</text></svg>`
    ),
  },
  {
    id: "fire",
    title: "Fire",
    src: svgData(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><path d="M40 8c8 12 18 18 18 34a18 18 0 1 1-36 0c0-10 6-16 10-22 2 6 8 10 8 16 0-14 6-22 0-28z" fill="#F97316"/><path d="M40 42c4 0 8 4 8 10a8 8 0 1 1-16 0c0-4 3-7 8-10z" fill="#FDE047"/></svg>`
    ),
  },
  {
    id: "trophy",
    title: "Trophy",
    src: svgData(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><path d="M24 18h32v10c0 12-8 22-16 22s-16-10-16-22V18z" fill="#F5C542"/><path d="M24 22h-8c0 10 6 16 12 18" fill="none" stroke="#F5C542" stroke-width="6"/><path d="M56 22h8c0 10-6 16-12 18" fill="none" stroke="#F5C542" stroke-width="6"/><rect x="36" y="50" width="8" height="10" fill="#D4A017"/><rect x="28" y="60" width="24" height="8" rx="2" fill="#F5C542"/></svg>`
    ),
  },
  {
    id: "rocket",
    title: "Rocket",
    src: svgData(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><path d="M40 8c12 10 16 28 12 42l-12 6-12-6C24 36 28 18 40 8z" fill="#7C5CBF"/><circle cx="40" cy="28" r="6" fill="#EDE9FE"/><path d="M28 50l-8 18 12-8 8 4 8-4 12 8-8-18" fill="#F97316"/></svg>`
    ),
  },
  {
    id: "crown",
    title: "Crown",
    src: svgData(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><path d="M12 58V28l16 12 12-20 12 20 16-12v30H12z" fill="#F5C542"/><circle cx="12" cy="26" r="5" fill="#F97316"/><circle cx="40" cy="16" r="5" fill="#F97316"/><circle cx="68" cy="26" r="5" fill="#F97316"/></svg>`
    ),
  },
  {
    id: "chart",
    title: "Chart up",
    src: svgData(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect x="10" y="10" width="60" height="60" rx="10" fill="#ECFDF5"/><path d="M20 52l14-16 10 8 16-22" fill="none" stroke="#16A34A" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M48 22h14v14" fill="none" stroke="#16A34A" stroke-width="6" stroke-linecap="round"/></svg>`
    ),
  },
  {
    id: "diamond",
    title: "Diamond",
    src: svgData(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><path d="M40 12l22 20-22 36L18 32 40 12z" fill="#67E8F9"/><path d="M18 32h44L40 12 18 32z" fill="#A5F3FC"/><path d="M40 12v56" stroke="#22D3EE" stroke-width="2"/></svg>`
    ),
  },
  {
    id: "star",
    title: "Star",
    src: svgData(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><path d="M40 8l8 22h22L54 44l8 24-22-14-22 14 8-24L10 30h22z" fill="#F5C542"/></svg>`
    ),
  },
  {
    id: "hundred",
    title: "100",
    src: svgData(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect x="8" y="22" width="64" height="36" rx="10" fill="#EF4444"/><text x="40" y="48" text-anchor="middle" font-size="22" font-family="Arial" fill="white" font-weight="800">100</text></svg>`
    ),
  },
  {
    id: "lightning",
    title: "Lightning",
    src: svgData(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><path d="M44 8L20 44h18L32 72l32-40H46L56 8z" fill="#FACC15"/></svg>`
    ),
  },
  {
    id: "party",
    title: "Party",
    src: svgData(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><path d="M16 64l20-36 28 16-20 28z" fill="#A855F7"/><circle cx="52" cy="18" r="4" fill="#F43F5E"/><circle cx="64" cy="28" r="4" fill="#22C55E"/><circle cx="58" cy="40" r="4" fill="#F59E0B"/><circle cx="70" cy="18" r="3" fill="#38BDF8"/></svg>`
    ),
  },
  {
    id: "gem",
    title: "Gem",
    src: svgData(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><path d="M24 16h32l16 18-32 32L8 34 24 16z" fill="#8B5CF6"/><path d="M24 16h32L40 34 24 16z" fill="#C4B5FD"/></svg>`
    ),
  },
];
