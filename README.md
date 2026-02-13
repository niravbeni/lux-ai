# Lux AI — Future Store Eyewear Experience

A luxury in-store eyewear discovery prototype. Browse premium frames in 3D, speak to a personalised AI concierge, get camera-based colour and fit recommendations, and explore colourways — all from your phone.

Built for Luxottica's next-generation retail kiosks, featuring Ray-Ban, Oakley, and Ray-Ban Aviator frames.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on your phone or browser.

### Demo Mode

Append `?demo=true` to bypass camera/mic requirements:

```
http://localhost:3000?demo=true
```

## Setup

### 1. Environment Variables

Create a `.env.local` file:

```bash
OPENAI_API_KEY=your_openai_key
ELEVENLABS_API_KEY=your_elevenlabs_key
```

- **OpenAI** — Powers the conversational AI concierge (GPT-4o-mini)
- **ElevenLabs** — Text-to-speech for spoken responses (falls back to browser speech synthesis if unavailable)

### 2. GLB Models

The 3D frame models should be placed at:

```
public/models/source/rayban.glb
public/models/source/oakley.glb
public/models/source/aviator.glb
```

### 3. Run

```bash
npm run dev     # Development
npm run build   # Production build
npm start       # Production server
```

## Features

### AI Concierge
- **Voice assistant** — Full-screen mode with a custom GLSL shader orb that morphs organically while speaking
- **Text chat** — Inline responses on the product page, read aloud via TTS
- **Personalised recommendations** — Randomised user profiles (lifestyle, hobbies, prescription, face shape) shape every conversation
- **Frame suggestions** — Mention you need something sporty or fashionable and the AI recommends a different frame, automatically switching the 3D view
- **Colourway suggestions** — Mention an outfit, event, or colour preference and the AI recommends a matching colourway, applied live to the 3D model

### 3D Product Viewer
- **Interactive orbit controls** — Rotate and explore frames with touch gestures
- **Intro spin animation** — Elegant reveal when a product page loads
- **Universal colourway system** — Any colourway can be applied to any frame via switchable pills
- **Dynamic material swapping** — PBR-correct colour/texture changes with logo protection
- **Per-product display scaling** — Each frame renders at its correct relative size

### Camera-Based Analysis
- **Colour Match** — Scans your face, estimates skin tone depth and undertone, then recommends complementary frame colourways using colour theory
- **Fit & Sizing** — Contour-based face shape and width analysis with frame size recommendations

### Product Catalog
- **Ray-Ban Meta Smart Glasses** — 12MP camera, Meta AI, open-ear speakers (49g)
- **Oakley Meta Vanguard** — Prizm lenses, O-Matter frame, built for sport (49g)
- **Ray-Ban Aviator Classic** — Crystal glass lenses, iconic teardrop shape (26g)

### Platform
- **QR Scanner** — Scan a frame's QR code to jump straight to its product page
- **PWA** — Add-to-home-screen, standalone mode, mobile-optimised
- **Haptic feedback** — Tactile responses throughout the experience
- **ElevenLabs TTS** — Natural voice output with browser speech fallback

## Tech Stack

- Next.js 15 (App Router, TypeScript)
- React Three Fiber + Drei (3D rendering)
- Three.js (material manipulation, GLSL shaders)
- Tailwind CSS v4 + Framer Motion (styling & animation)
- Zustand (state management)
- OpenAI GPT-4o-mini (conversational AI, streaming)
- ElevenLabs (text-to-speech)
- Web Speech API (speech-to-text)
- html5-qrcode (QR scanning)

## Deployment

Deploy to Vercel:

```bash
npx vercel
```

Or connect your GitHub repo to Vercel for automatic deployments.

Add these environment variables in your Vercel project settings:
- `OPENAI_API_KEY`
- `ELEVENLABS_API_KEY`

## Project Structure

```
src/
├── app/              # Next.js App Router pages + API routes
│   └── api/          # Chat (GPT streaming) + TTS endpoints
├── components/
│   ├── camera/       # Camera feed + face scanner
│   ├── landing/      # Landing screen
│   ├── modes/        # Colour match, fit & sizing, details
│   ├── orb/          # AI orb (R3F + custom GLSL shaders)
│   ├── scanner/      # QR scanner
│   ├── shared/       # Permission gate, etc.
│   ├── ui/           # Bottom sheet, save modal, transitions
│   ├── viewer/       # 3D viewer hub, frame model, suggestion pills
│   └── voice/        # Voice input, speech hook
├── data/             # Product catalog, user profiles, dialogue scripts
├── lib/              # TTS, haptics, keyword router
└── store/            # Zustand state management
```
