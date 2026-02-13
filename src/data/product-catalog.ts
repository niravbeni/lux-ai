import { Colourway } from '@/store/app-store';

// ---------------------------------------------------------------------------
// Product catalog — every frame the store assistant can recommend
// ---------------------------------------------------------------------------

export interface Product {
  id: string;
  name: string;
  tagline: string;
  whyItMatters: string;
  features: string[];
  goodFor: string[];
  careNote: string;
  weight: string;
  style: string[];
  prescriptionReady: boolean;
  modelPath: string;
  /** Multiplier applied after auto-fit normalisation (default 1.0) */
  displayScale?: number;
  colourways: Colourway[];
  sizes: Record<string, { lensWidth: string; bridge: string; templeLength: string }>;
}

// ── Ray-Ban Meta Smart Glasses ──────────────────────────────────────────────

const raybanMetaColourways: Colourway[] = [
  { id: 'shiny-black', name: 'Shiny Black', color: '#1a1a1a', metalness: 0.3, roughness: 0.2 },
  { id: 'matte-black', name: 'Matte Black', color: '#2a2a2a', metalness: 0.1, roughness: 0.8 },
  { id: 'havana', name: 'Havana', color: '#8B5E3C', metalness: 0.2, roughness: 0.4 },
  { id: 'transparent-blue', name: 'Transparent Blue', color: '#4A7C9B', metalness: 0.15, roughness: 0.3 },
  { id: 'warm-gunmetal', name: 'Warm Gunmetal', color: '#6B6B6B', metalness: 0.6, roughness: 0.25 },
];

const raybanMeta: Product = {
  id: 'rayban-meta',
  name: 'Ray-Ban Meta Smart Glasses',
  tagline: 'Smart eyewear, iconic design.',
  whyItMatters: 'Try it here, leave with the one that fits your style and face.',
  features: [
    'Ultra-wide 12MP camera for photos & video',
    'Open-ear speakers with immersive audio',
    'Built-in Meta AI voice assistant',
    'Livestream directly to Instagram & Facebook',
    'Qualcomm AR1 Gen 1 processor',
    'Up to 4 hours continuous use',
  ],
  goodFor: [
    'Hands-free content capture',
    'Calls & music on the go',
    'Discreet AI assistance',
    'Style-forward everyday wear',
  ],
  careNote:
    'Wipe lenses with the included microfiber cloth. Charge via the included case — a full charge takes about 75 minutes.',
  weight: '49g',
  style: ['tech', 'everyday', 'smart'],
  prescriptionReady: true,
  modelPath: '/models/source/rayban.glb',
  colourways: raybanMetaColourways,
  sizes: {
    standard: { lensWidth: '50mm', bridge: '22mm', templeLength: '145mm' },
    large: { lensWidth: '53mm', bridge: '22mm', templeLength: '150mm' },
  },
};

// ── Oakley Meta Vanguard (sporty / outdoor) ─────────────────────────────────

const oakleyVanguardColourways: Colourway[] = [
  { id: 'matte-black', name: 'Matte Black', color: '#1c1c1c', metalness: 0.1, roughness: 0.85 },
  { id: 'matte-carbon', name: 'Matte Carbon', color: '#3a3a3a', metalness: 0.15, roughness: 0.75 },
  { id: 'olive-ink', name: 'Olive Ink', color: '#4a5a3a', metalness: 0.1, roughness: 0.7 },
];

const oakleyVanguard: Product = {
  id: 'oakley-vanguard',
  name: 'Oakley Meta Vanguard',
  tagline: 'Smart performance eyewear for the trail and beyond.',
  whyItMatters: 'Built for athletes who want hands-free tech without compromising on performance or durability.',
  features: [
    'Built-in Meta AI voice assistant & smart features',
    '12MP ultra-wide camera for photos & video',
    'Plutonite lenses — 100% UV protection',
    'Prizm lens technology for enhanced contrast',
    'O-Matter frame — lightweight & stress-resistant',
    'Unobtainium earsocks & nosepads for grip when you sweat',
    'Open-ear speakers for situational awareness',
    'Up to 4 hours continuous use',
  ],
  goodFor: [
    'Trail running & hiking',
    'Cycling & mountain biking',
    'Outdoor sports in variable light',
    'Hands-free content capture on the move',
  ],
  careNote:
    'Rinse under cool water after exercise. Use the included microbag for cleaning and storage. Charge via the included case.',
  weight: '49g',
  style: ['sporty', 'outdoor', 'athletic', 'performance', 'smart'],
  prescriptionReady: true,
  modelPath: '/models/source/oakley.glb',
  colourways: oakleyVanguardColourways,
  sizes: {
    standard: { lensWidth: '39mm', bridge: '139mm', templeLength: '128mm' },
  },
};

// ── Ray-Ban Aviator (fashion / elegant) ─────────────────────────────────────

const aviatorColourways: Colourway[] = [
  { id: 'gold-green', name: 'Gold / Green Classic', color: '#B8860B', metalness: 0.8, roughness: 0.1 },
  { id: 'silver-blue', name: 'Silver / Gradient Blue', color: '#A8A9AD', metalness: 0.85, roughness: 0.1 },
  { id: 'black', name: 'Black', color: '#1a1a1a', metalness: 0.6, roughness: 0.15 },
  { id: 'rose-gold', name: 'Rose Gold', color: '#B76E79', metalness: 0.8, roughness: 0.1 },
];

const aviator: Product = {
  id: 'rayban-aviator',
  name: 'Ray-Ban Aviator Classic',
  tagline: 'The original icon. Effortlessly refined since 1937.',
  whyItMatters: 'A timeless silhouette that elevates any look — from casual weekends to formal evenings.',
  features: [
    'Crystal glass lenses for optical clarity',
    'Iconic teardrop lens shape',
    'Lightweight metal frame — only 26g',
    'Adjustable nose pads for a custom fit',
    'Full UV400 protection',
    'Signature Ray-Ban logo etched on lens',
  ],
  goodFor: [
    'Fashion-forward everyday wear',
    'Dinners, events & social occasions',
    'Driving & travel',
    'Classic style that pairs with everything',
  ],
  careNote:
    'Store in the branded leather case when not in use. Clean lenses with the included microfiber cloth — avoid chemical cleaners on metal frames.',
  weight: '26g',
  style: ['fashion', 'elegant', 'classic', 'iconic', 'lightweight'],
  prescriptionReady: true,
  modelPath: '/models/source/aviator.glb',
  displayScale: 0.82,
  colourways: aviatorColourways,
  sizes: {
    small: { lensWidth: '55mm', bridge: '14mm', templeLength: '135mm' },
    standard: { lensWidth: '58mm', bridge: '14mm', templeLength: '135mm' },
    large: { lensWidth: '62mm', bridge: '14mm', templeLength: '140mm' },
  },
};

// ── Catalog ─────────────────────────────────────────────────────────────────

export const productCatalog: Product[] = [raybanMeta, oakleyVanguard, aviator];

export function getProduct(id: string): Product {
  return productCatalog.find((p) => p.id === id) ?? raybanMeta;
}

export const DEFAULT_PRODUCT_ID = 'rayban-meta';

// ── Universal colourway pool ────────────────────────────────────────────────
// Every colourway from every product, de-duplicated by id.
// Any colourway can be applied to any frame (they're just material properties).
const cwMap = new Map<string, import('@/store/app-store').Colourway>();
for (const p of productCatalog) {
  for (const cw of p.colourways) {
    if (!cwMap.has(cw.id)) cwMap.set(cw.id, cw);
  }
}
export const allColourways = Array.from(cwMap.values());

/** Look up any colourway by id across the entire catalog */
export function getColourway(id: string): import('@/store/app-store').Colourway | undefined {
  return cwMap.get(id);
}

// ── Backward-compatible re-exports ──────────────────────────────────────────
// Many components still import { productData, colourways } from '@/data/product-data'
// These re-exports ensure nothing breaks during migration.

export const productData = {
  ...raybanMeta,
  // Legacy field alias
  modelPath: raybanMeta.modelPath,
};

export const colourways = raybanMetaColourways;
