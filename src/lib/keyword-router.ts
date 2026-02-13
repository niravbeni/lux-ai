import { AppScreen } from '@/store/app-store';

type RouteResult = {
  screen: AppScreen;
  confidence: number;
} | null;

const routeMap: { keywords: string[]; screen: AppScreen }[] = [
  {
    keywords: ['colour', 'color', 'shade', 'tone', 'finish', 'colourway', 'colorway', 'hue', 'tint'],
    screen: 'colour-mode',
  },
  {
    keywords: ['size', 'fit', 'width', 'bridge', 'narrow', 'wide', 'measurement', 'measure', 'sizing'],
    screen: 'fit-mode',
  },
  {
    keywords: ['details', 'detail', 'info', 'specs', 'spec', 'battery', 'features', 'feature', 'camera', 'speaker', 'material', 'weight', 'technology', 'tech'],
    screen: 'details-mode',
  },
  {
    keywords: ['save', 'done', 'continue', 'checkout', 'buy', 'purchase', 'finish shopping'],
    screen: 'save-modal',
  },
  {
    keywords: ['scan', 'another', 'new frame', 'different', 'other'],
    screen: 'scanner',
  },
];

export function routeFromTranscript(transcript: string): RouteResult {
  const lower = transcript.toLowerCase().trim();
  if (!lower) return null;

  let bestMatch: RouteResult = null;
  let highestScore = 0;

  for (const route of routeMap) {
    for (const keyword of route.keywords) {
      if (lower.includes(keyword)) {
        // Longer keyword matches are more specific
        const score = keyword.length;
        if (score > highestScore) {
          highestScore = score;
          bestMatch = { screen: route.screen, confidence: Math.min(score / 10, 1) };
        }
      }
    }
  }

  return bestMatch;
}
