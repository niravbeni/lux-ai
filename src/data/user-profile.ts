// ── Randomised user profile ──────────────────────────────────────────
// A fresh persona is generated every time the module is first evaluated
// (i.e. once per server cold-start / page refresh).  The AI uses this
// to personalise recommendations without ever revealing the name.

export interface UserProfile {
  name: string;
  age: number;
  occupation: string;
  environment: 'urban' | 'suburban' | 'rural';
  screenTime: 'low' | 'moderate' | 'high' | 'very high';
  prescription: {
    sphere: number;
    cylinder: number;
    note: string;
  };
  climate: string;
  lifestyle: string;
  hobbies: string[];
  stylePreferences: string[];
  prioritises: string[];
  faceShape: string;
}

// ── Trait pools ──────────────────────────────────────────────────────

const names = [
  'Alex', 'Jordan', 'Sam', 'Taylor', 'Morgan', 'Casey', 'Riley',
  'Avery', 'Quinn', 'Jamie', 'Drew', 'Skyler', 'Reese', 'Finley',
];

const occupations = [
  'software engineer', 'graphic designer', 'marketing manager',
  'architect', 'teacher', 'photographer', 'nurse',
  'financial analyst', 'freelance writer', 'product manager',
  'personal trainer', 'chef', 'lawyer', 'data scientist',
  'music producer', 'civil engineer', 'social media strategist',
];

const environments: UserProfile['environment'][] = ['urban', 'suburban', 'rural'];

const screenTimeLevels: UserProfile['screenTime'][] = ['low', 'moderate', 'high', 'very high'];

const climates = [
  'hot and sunny year-round (e.g. LA, Dubai)',
  'four distinct seasons with cold winters (e.g. New York, London)',
  'mild and rainy (e.g. Seattle, Manchester)',
  'tropical and humid (e.g. Singapore, Miami)',
  'dry and arid (e.g. Phoenix, Marrakech)',
  'Mediterranean — warm summers, mild winters (e.g. Barcelona, Sydney)',
  'cold and snowy for much of the year (e.g. Montreal, Stockholm)',
];

const lifestyles = [
  'Active outdoors — spends most weekends hiking, cycling, or running.',
  'City social — restaurants, galleries, rooftop bars, and weekend brunches.',
  'Work-from-home creative — long screen hours, values comfort and style on video calls.',
  'Frequent traveller — airports, hotels, and adapting to different climates weekly.',
  'Fitness-focused — gym six days a week, occasional outdoor bootcamps.',
  'Young parent — always on the go, needs durable and practical gear.',
  'Student lifestyle — campus, libraries, late nights, budget-conscious but style-aware.',
  'Corporate professional — suits during the week, casual-smart on weekends.',
  'Outdoor adventurer — rock climbing, kayaking, ski trips, loves rugged gear.',
  'Relaxed suburbanite — weekend BBQs, driving, gardening, coaching kids\' sports.',
];

const hobbyPool = [
  'hiking', 'trail running', 'road cycling', 'mountain biking',
  'photography', 'videography', 'painting', 'sketching',
  'yoga', 'CrossFit', 'swimming', 'surfing', 'skateboarding',
  'cooking', 'baking', 'gardening', 'woodworking',
  'reading', 'podcasts', 'gaming', 'live music',
  'travel', 'camping', 'rock climbing', 'skiing',
  'tennis', 'golf', 'basketball', 'football',
  'fashion', 'thrifting', 'interior design', 'blogging',
  'volunteering', 'dog walking', 'bird watching', 'fishing',
];

const stylePool = [
  'minimalist', 'streetwear', 'classic/preppy', 'athleisure',
  'bohemian', 'smart-casual', 'techwear', 'vintage',
  'Scandinavian clean', 'bold and colourful', 'monochrome',
  'outdoor/gorpcore', 'business formal', 'relaxed coastal',
];

const priorityPool = [
  'comfort', 'durability', 'lightweight', 'style',
  'UV protection', 'prescription compatibility', 'brand reputation',
  'tech features', 'versatility', 'value for money',
  'sustainability', 'low maintenance',
];

const faceShapes = ['oval', 'round', 'square', 'heart', 'oblong'];

// ── Helpers ──────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], min: number, max: number): T[] {
  const n = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randomPrescription(): UserProfile['prescription'] {
  // ~40% chance of no prescription needed
  if (Math.random() < 0.4) {
    return { sphere: 0, cylinder: 0, note: 'No prescription needed — perfect vision' };
  }

  // Myopia (negative sphere) is more common
  const isMild = Math.random() < 0.5;
  const sphere = isMild
    ? -(Math.floor(Math.random() * 4 + 1) * 0.25)   // -0.25 to -1.00
    : -(Math.floor(Math.random() * 12 + 4) * 0.25);  // -1.00 to -4.00

  const cylinder = Math.random() < 0.6 ? 0 : -(Math.floor(Math.random() * 4 + 1) * 0.25);

  const severity =
    Math.abs(sphere) <= 1 ? 'mild' :
    Math.abs(sphere) <= 2.5 ? 'moderate' : 'significant';

  const note = `${severity} myopia — needs prescription-ready frames${
    cylinder !== 0 ? ' with astigmatism correction' : ''
  }`;

  return { sphere, cylinder, note };
}

// ── Generate a random profile ────────────────────────────────────────

export function generateUserProfile(): UserProfile {
  const env = pick(environments);
  const screenTime = pick(screenTimeLevels);

  return {
    name: pick(names),
    age: 22 + Math.floor(Math.random() * 30), // 22–51
    occupation: pick(occupations),
    environment: env,
    screenTime,
    prescription: randomPrescription(),
    climate: pick(climates),
    lifestyle: pick(lifestyles),
    hobbies: pickN(hobbyPool, 3, 6),
    stylePreferences: pickN(stylePool, 2, 4),
    prioritises: pickN(priorityPool, 2, 4),
    faceShape: pick(faceShapes),
  };
}

// Default export — generated once at module load (per server restart / page load)
export const userProfile: UserProfile = generateUserProfile();
