import { Colourway } from '@/store/app-store';

export const colourways: Colourway[] = [
  {
    id: 'shiny-black',
    name: 'Shiny Black',
    color: '#1a1a1a',
    metalness: 0.3,
    roughness: 0.2,
  },
  {
    id: 'matte-black',
    name: 'Matte Black',
    color: '#2a2a2a',
    metalness: 0.1,
    roughness: 0.8,
  },
  {
    id: 'havana',
    name: 'Havana',
    color: '#8B5E3C',
    metalness: 0.2,
    roughness: 0.4,
  },
  {
    id: 'transparent-blue',
    name: 'Transparent Blue',
    color: '#4A7C9B',
    metalness: 0.15,
    roughness: 0.3,
  },
  {
    id: 'warm-gunmetal',
    name: 'Warm Gunmetal',
    color: '#6B6B6B',
    metalness: 0.6,
    roughness: 0.25,
  },
];

export const productData = {
  id: 'rayban-meta-smart-glasses',
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
  sizes: {
    standard: { lensWidth: '50mm', bridge: '22mm', templeLength: '145mm' },
    large: { lensWidth: '53mm', bridge: '22mm', templeLength: '150mm' },
  },
  modelPath: '/models/source/rayban.glb',
};
