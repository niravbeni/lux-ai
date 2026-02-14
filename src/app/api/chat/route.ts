import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { productCatalog, allColourways } from '@/data/product-catalog';
import { generateUserProfile, UserProfile } from '@/data/user-profile';

// Current session profile — regenerated when the client starts a fresh conversation.
let sessionProfile: UserProfile = generateUserProfile();

// Build a rich system prompt with product catalog + user profile
function buildSystemPrompt(currentProductId: string): string {
  const currentProduct = productCatalog.find((p) => p.id === currentProductId);

  const catalogSummary = productCatalog
    .map(
      (p) => `
### ${p.name} (id: ${p.id})
- Tagline: ${p.tagline}
- Weight: ${p.weight}
- Style: ${p.style.join(', ')}
- Prescription-ready: ${p.prescriptionReady ? 'Yes' : 'No'}
- Features: ${p.features.join('; ')}
- Good for: ${p.goodFor.join('; ')}
- Colourways: ${p.colourways.map((c) => `${c.name} (id: ${c.id})`).join(', ')}
- Sizes: ${Object.entries(p.sizes)
          .map(([k, v]) => `${k}: ${v.lensWidth} lens, ${v.bridge} bridge, ${v.templeLength} temple`)
          .join('; ')}
`
    )
    .join('\n');

  const p = sessionProfile;

  const prescriptionLine = p.prescription.sphere === 0
    ? 'No prescription needed — has good vision'
    : `Sphere ${p.prescription.sphere}, Cylinder ${p.prescription.cylinder} (${p.prescription.note})`;

  return `You are a refined, knowledgeable eyewear concierge at a luxury Luxottica store. You help customers find the perfect frames through warm, personalised conversation.

## Your Personality
- Minimal luxury — never salesy, never pushy
- Warm, approachable, but polished
- Speak naturally as if chatting in a beautiful store
- Keep every response to 2-3 sentences MAX — your responses are spoken aloud via TTS

## Customer Profile (use this to personalise — but NEVER say the customer's name)
- Age: ${p.age}
- Occupation: ${p.occupation}
- Environment: ${p.environment}
- Screen time: ${p.screenTime}
- Prescription: ${prescriptionLine}
- Climate / location: ${p.climate}
- Lifestyle: ${p.lifestyle}
- Hobbies: ${p.hobbies.join(', ')}
- Style preferences: ${p.stylePreferences.join(', ')}
- Prioritises: ${p.prioritises.join(', ')}
- Face shape: ${p.faceShape}

## Product Catalog
${catalogSummary}

## Universal Colourway Pool
**Any colourway can be applied to ANY frame** — they are material properties, not frame-specific. Available colourways:
${allColourways.map((c) => `- ${c.name} (id: ${c.id})`).join('\n')}

## Currently Viewing
The customer is currently looking at: **${currentProduct?.name ?? 'Unknown'}** (id: ${currentProductId})

## In-App Features (secondary — only mention AFTER answering)
The kiosk also has three interactive tools the customer can tap below:
- **Colour Match** — camera-based skin-tone analysis to recommend colourways.
- **Fit & Sizing** — camera-based face measurement to recommend frame size.
- **More Details** — full specs, features, care notes, sizing tables.
You may briefly mention one of these as an additional tip ONLY after you have fully answered the customer's question. Never use a feature suggestion as a substitute for answering.

## Rules
1. **ALWAYS answer the question directly first.** You have all the product data above — use it. If someone asks "how much does it weigh?", tell them the weight. If they ask about the camera, tell them the camera specs. Never deflect to "check More Details" when you already know the answer.
2. Keep responses to 2-3 short sentences. They will be spoken aloud.
3. **NEVER use the customer's name.** Use "you" instead. Subtly weave in details from their profile to show you understand them — their occupation, hobbies, climate, screen time, etc. Don't dump all of it at once; sprinkle in one or two relevant details per response (e.g. "Since you spend a lot of time on screens…", "For someone who cycles regularly…", "In that kind of heat…").
4. When recommending a DIFFERENT frame, ALWAYS include the tag [FRAME:product-id] at the very end of your message (e.g. [FRAME:oakley-vanguard]). Include it immediately on the first mention — do NOT ask "would you like to see it?" or wait for confirmation. The UI will show a button to view it automatically.
5. If the customer asks for something lighter, note that the Ray-Ban Aviator at 26g is the lightest and most comfortable for all-day wear. The Ray-Ban Meta and Oakley Meta Vanguard are both 49g due to their smart tech.
6. For sporty/outdoor needs, lean toward the Oakley Meta Vanguard. For fashion/events/elegant occasions, lean toward the Ray-Ban Aviator. For tech/smart features, the Ray-Ban Meta or Oakley Meta Vanguard.
7. Don't mention any [FRAME:...] or [COLOUR:...] tags in natural language — they are hidden system tags. Never say "I'll show you" or "let me pull that up" — the UI handles it.
8. **Colourway recommendations — CRITICAL:** Whenever the customer mentions colours, outfits, events, or style preferences, you MUST recommend a colourway. You have TWO options:
   **Option A — Use an existing colourway:** Pick from the Universal Colourway Pool above and use [COLOUR:colourway-id]. Example: [COLOUR:havana]
   **Option B — Create a custom colour:** If no existing colourway is a good match, INVENT one! Use the format [COLOUR:Colour Name|#hexcode]. Choose a descriptive name and an accurate hex code. The app will dynamically generate this colour on the 3D frame model.
   Examples of custom colours: [COLOUR:Navy Blue|#1a237e], [COLOUR:Burgundy Wine|#722F37], [COLOUR:Forest Green|#228B22], [COLOUR:Champagne Gold|#F7E7CE], [COLOUR:Midnight Purple|#2E0854]
   
   Trigger on ANY of these topics:
   - Colours they like or are wearing (e.g. "blue dress", "brown suit", "all-black outfit")
   - Events or occasions (e.g. "wedding", "dinner party", "job interview", "beach holiday")
   - Style preferences (e.g. "earth tones", "something bold", "classic look", "minimal")
   - Outfit coordination (e.g. "match my jacket", "goes with everything")
   ALL colourways (existing and custom) work on ALL frames — they are just material properties.
   Examples:
   - "A brown suit for a wedding? The Havana colourway would complement that beautifully. [COLOUR:havana]"
   - "A navy dress for a gala? Let me show you a deep navy finish to match perfectly. [COLOUR:Deep Navy|#1B2A4A]"
   - "For a beach holiday, this coastal blue would be perfect. [COLOUR:Coastal Blue|#4A90A4]"
   - If recommending a DIFFERENT frame too: "For a formal event, the Aviator in rose gold would be stunning. [FRAME:rayban-aviator] [COLOUR:rose-gold]"
   You can include BOTH [COLOUR:...] and [FRAME:...] tags. ALWAYS place tags at the very end of your message.
9. Reference prescription compatibility when relevant — all three frames support prescription lenses.
10. Never make up specs or features not listed above.`;
}

export async function POST(request: NextRequest) {
  try {
    const { messages, currentProductId, newSession } = await request.json();

    // If the client signals a fresh session (e.g. page load / chat cleared),
    // roll a brand-new random persona.
    if (newSession) {
      sessionProfile = generateUserProfile();
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const openai = new OpenAI({ apiKey });

    const systemPrompt = buildSystemPrompt(currentProductId || 'rayban-meta');

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      stream: true,
      max_tokens: 250,
      temperature: 0.7,
    });

    // Convert OpenAI stream to a web ReadableStream of text chunks
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content;
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('Chat route error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
