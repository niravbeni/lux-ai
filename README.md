# Ray-Ban | Meta — Future Store Experience

A PWA prototype demonstrating a future in-store eyewear discovery journey. Scan a frame, explore it in 3D, speak to an AI assistant, and get personalised colour and fit recommendations.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on your phone or browser.

### Demo Mode

Append `?demo=true` to the URL to bypass camera/mic requirements and use simulated responses:

```
http://localhost:3000?demo=true
```

## Setup

### 1. GLB Model

Place your Ray-Ban Meta GLB file at:

```
public/models/rayban-meta.glb
```

Without this file, the 3D viewer will show a wireframe placeholder.

### 2. ElevenLabs TTS (Optional)

Copy `.env.local` and add your API key:

```bash
ELEVENLABS_API_KEY=your_key_here
```

Without a key, the assistant's responses will display as text only (no voice).

### 3. Run

```bash
npm run dev     # Development
npm run build   # Production build
npm start       # Production server
```

## Features

- **QR Scanner** — Scan a frame's QR code using the back camera
- **3D Viewer** — Interactive GLB model with orbit controls and colourway switching
- **Voice Input** — Speak naturally using Web Speech API (with text fallback)
- **AI Orb** — Custom GLSL shader orb that responds to interaction states
- **Colour Mode** — Front camera face scan with scripted colour recommendations
- **Fit Mode** — Face measurement overlay with size guidance
- **Details Mode** — Bottom sheet with full product specs
- **TTS** — ElevenLabs text-to-speech for assistant responses
- **PWA** — Add-to-home-screen, standalone mode, mobile-optimised

## Tech Stack

- Next.js 15 (App Router, TypeScript)
- React Three Fiber + Drei (3D)
- Tailwind CSS v4 + Framer Motion
- Zustand (state management)
- html5-qrcode (QR scanning)
- Web Speech API (STT)
- ElevenLabs (TTS)
- MediaPipe-inspired face detection overlays

## Deployment

Deploy to Vercel:

```bash
npx vercel
```

Or connect your GitHub repo to Vercel for automatic deployments.

Make sure to add `ELEVENLABS_API_KEY` as an environment variable in your Vercel project settings.

## Project Structure

```
src/
├── app/              # Next.js App Router pages + API routes
├── components/       # UI components by feature
│   ├── camera/       # Camera feed + face scanner
│   ├── landing/      # Landing screen
│   ├── modes/        # Colour, fit, details modes
│   ├── orb/          # AI orb (R3F + GLSL)
│   ├── scanner/      # QR scanner
│   ├── shared/       # Permission gate, etc.
│   ├── ui/           # Bottom sheet, save modal, transitions
│   ├── viewer/       # 3D viewer hub + model
│   └── voice/        # Voice input + speech hook
├── data/             # Product data + dialogue scripts
├── lib/              # Utilities (TTS, haptics, keyword router)
└── store/            # Zustand state management
```
