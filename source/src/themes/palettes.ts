export interface Palette {
  background: string; surface: string; raised: string; hover: string;
  text: string; muted: string; accent: string; border: string; highlight: string;
}

export const PALETTES = {
  enhanced: { background: '#0f141b', surface: '#161e28', raised: '#1d2835', hover: '#263647', text: '#e6edf3', muted: '#afbdcb', accent: '#80ccef', border: '#3c5065', highlight: '#bfa739' },
  oled: { background: '#000000', surface: '#090909', raised: '#151515', hover: '#252525', text: '#f0f0f0', muted: '#bdbdbd', accent: '#86d9ff', border: '#454545', highlight: '#bfa739' },
  navy: { background: '#080f1d', surface: '#101e32', raised: '#1a2b44', hover: '#253b58', text: '#e7eff9', muted: '#b4c8df', accent: '#83c7ff', border: '#405875', highlight: '#bfa739' },
  anvil: { background: '#111510', surface: '#1a2018', raised: '#252d22', hover: '#323e2e', text: '#edf0e8', muted: '#c0c9b7', accent: '#d7c983', border: '#52604a', highlight: '#bfa739' },
  aegis: { background: '#141212', surface: '#211b1b', raised: '#302525', hover: '#423232', text: '#f2eaea', muted: '#d1baba', accent: '#f2a5a5', border: '#685050', highlight: '#bfa739' },
  origin: { background: '#16151b', surface: '#221f29', raised: '#302c37', hover: '#403a48', text: '#f6f0e6', muted: '#d1c5b8', accent: '#e3c899', border: '#62596c', highlight: '#bfa739' },
  chrisRoberts: { background: '#030b18', surface: '#081729', raised: '#10253b', hover: '#18334b', text: '#e5fbff', muted: '#b0d7e9', accent: '#78f5ff', border: '#397c99', highlight: '#bfa739' },
  drake: { background: '#100f10', surface: '#191717', raised: '#252120', hover: '#37302d', text: '#f3ece8', muted: '#cbbcb2', accent: '#ffc19a', border: '#58443b', highlight: '#bfa739' },
  crusader: { background: '#081622', surface: '#0f2233', raised: '#18334a', hover: '#26475f', text: '#e9f5ff', muted: '#bad5e8', accent: '#92d9ff', border: '#41617a', highlight: '#bfa739' },
  rsi: { background: '#101319', surface: '#181e27', raised: '#222b37', hover: '#323d4c', text: '#edf2f7', muted: '#c0c9d4', accent: '#ff9992', border: '#4b5a6b', highlight: '#bfa739' },
  nebula: { background: '#0e0b1a', surface: '#18142a', raised: '#25203e', hover: '#352d52', text: '#f2eeff', muted: '#c9c1e0', accent: '#d3b8ff', border: '#594c78', highlight: '#bfa739' },
  aurora: { background: '#081515', surface: '#10221f', raised: '#19332e', hover: '#26473f', text: '#e8f7f1', muted: '#bad7cc', accent: '#9af0d0', border: '#42675b', highlight: '#bfa739' },
  eclipse: { background: '#11100e', surface: '#1d1a15', raised: '#2a251c', hover: '#3b3427', text: '#f4efe3', muted: '#d0c4a8', accent: '#ffd576', border: '#60533b', highlight: '#bfa739' },
  xianJade: { background: '#0b1118', surface: '#121b23', raised: '#1a2930', hover: '#263b3b', text: '#e7f0ee', muted: '#aabbb7', accent: '#43d6b0', border: '#34474c', highlight: '#d5b879' },
  pyroEmber: { background: '#100e0c', surface: '#191614', raised: '#25201c', hover: '#352a22', text: '#f3e9de', muted: '#b9aaa0', accent: '#f28a55', border: '#514038', highlight: '#f1bb73' },
  terraFrontier: { background: '#131712', surface: '#1b211b', raised: '#293127', hover: '#394635', text: '#eceee3', muted: '#b6beaa', accent: '#a9c66f', border: '#46513f', highlight: '#d8bd8b' },
} satisfies Record<string, Palette>;

export const THEME_NAMES = {
  enhanced: 'Spectrum Enhanced', oled: 'OLED Black', navy: 'UEE Navy',
  anvil: 'Anvil Industrial', aegis: 'Aegis Tactical', origin: 'Origin Luxury', chrisRoberts: 'Chris Roberts',
  drake: 'Drake Industrial', crusader: 'Crusader Sky', rsi: 'RSI Corporate',
  nebula: 'Nebula', aurora: 'Aurora', eclipse: 'Eclipse',
  xianJade: 'Xi’an Jade', pyroEmber: 'Pyro Ember', terraFrontier: 'Terra Frontier',
} as const;
export type ThemeId = keyof typeof THEME_NAMES;
export const COLOR_KEYS = ['background', 'surface', 'raised', 'hover', 'text', 'muted', 'accent', 'border', 'highlight'] as const;
