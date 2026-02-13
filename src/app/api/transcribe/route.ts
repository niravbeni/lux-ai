import { NextRequest } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: 'No audio file provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const openai = new OpenAI({ apiKey });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
    });

    return new Response(
      JSON.stringify({ text: transcription.text }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Transcribe route error:', error);
    return new Response(
      JSON.stringify({ error: 'Transcription failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
