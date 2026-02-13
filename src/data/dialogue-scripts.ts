// Scripted dialogue responses for the agentic assistant
// Each mode has 2-3 variations to feel alive

export const dialogueScripts = {
  hub: {
    greetings: [
      "This is the Ray-Ban Meta Smart Glasses in Shiny Black. An iconic shape with built-in intelligence. How can I help you explore it?",
      "You're looking at the Ray-Ban Meta Smart Glasses — smart eyewear in a timeless silhouette. Would you like to check the colour, fit, or features?",
      "Great choice. The Ray-Ban Meta Smart Glasses combine classic design with cutting-edge tech. Ask me anything — colour, fit, or details.",
    ],
    nudges: [
      "Try saying 'colour match' to find your ideal finish.",
      "I can check the fit for your face — just say 'fit' or 'size'.",
      "Want the full specs? Say 'details' or tap below.",
    ],
  },

  colour: {
    scanning: [
      "Let me take a look...",
      "Analysing your features...",
      "Reading your skin tone and colouring...",
    ],
    recommendations: {
      warm: [
        {
          text: "Based on your warm undertone, the Havana finish would be a beautiful complement. It picks up the golden tones in your complexion without competing.",
          topMatch: 'havana',
          alternative: 'warm-gunmetal',
        },
        {
          text: "I'd recommend the Havana for you — it harmonises with warm colouring beautifully. The Warm Gunmetal is a striking alternative if you prefer something cooler.",
          topMatch: 'havana',
          alternative: 'warm-gunmetal',
        },
      ],
      cool: [
        {
          text: "Your cooler colouring pairs exceptionally well with the Shiny Black. It creates a clean, high-contrast look. The Transparent Blue is a softer option worth considering.",
          topMatch: 'shiny-black',
          alternative: 'transparent-blue',
        },
        {
          text: "For your complexion, the Shiny Black creates the most elegant contrast. If you're drawn to colour, the Transparent Blue is a refined alternative.",
          topMatch: 'shiny-black',
          alternative: 'transparent-blue',
        },
      ],
      neutral: [
        {
          text: "You have the versatility to carry almost any finish. The Matte Black is effortlessly refined, and the Havana adds a warm character that works well with your neutral colouring.",
          topMatch: 'matte-black',
          alternative: 'havana',
        },
      ],
    },
    followUps: [
      "Want to see it in another finish?",
      "Would you like to try a different colourway?",
      "I can show you the alternative — just say the word.",
    ],
  },

  fit: {
    scanning: [
      "Let me measure your proportions...",
      "Checking your fit parameters...",
      "Analysing your facial geometry...",
    ],
    results: {
      narrow: [
        {
          text: "I'd recommend the standard size — 50mm lens width. Your face has elegant, narrower proportions, and the standard frame will sit beautifully without overpowering your features.",
          lensWidth: '50mm',
          fitNote: 'Slightly narrow — standard size recommended',
        },
      ],
      balanced: [
        {
          text: "Your proportions are well-balanced for this frame. The standard 50mm lens width would be ideal — it'll sit evenly across your brow line with a comfortable bridge fit.",
          lensWidth: '50mm',
          fitNote: 'Balanced — standard size, excellent fit',
        },
        {
          text: "You're right in the sweet spot. The standard frame will give you a clean, proportional look. 50mm lens width with the 22mm bridge should feel right.",
          lensWidth: '50mm',
          fitNote: 'Balanced — standard or large, both work',
        },
      ],
      wide: [
        {
          text: "I'd suggest going with the large size — 53mm lens width. Your face has strong, wider proportions, and the larger frame will feel more balanced and comfortable.",
          lensWidth: '53mm',
          fitNote: 'Slightly wide — large size recommended',
        },
      ],
    },
    followUps: [
      "Should I check which colour would work best on you?",
      "Want to see the detailed specs?",
      "Would you like to explore colour options next?",
    ],
  },

  details: {
    intro: [
      "Here's the full breakdown on the Ray-Ban Meta Smart Glasses.",
      "Let me walk you through the key specs and features.",
    ],
  },

  save: {
    confirmation: [
      "Your session is saved. Show this to an associate when you're ready.",
      "All set — your preferences are captured. An associate can pull this up for you.",
    ],
  },
};

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
