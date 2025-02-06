import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'No URL provided' },
        { status: 400 }
      );
    }

    // Скачиваем файл из Blob storage
    const response = await fetch(url);
    const audioData = await response.arrayBuffer();

    // Отправляем файл обратно в Blob storage
    const buffer = Buffer.from(audioData);
    const { url: processedUrl } = await put('processed.mp3', buffer, {
      access: 'public',
      contentType: 'audio/mpeg'
    });

    return NextResponse.json({ 
      success: true, 
      url: processedUrl 
    });

  } catch (error) {
    console.error('Error processing audio:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
} 