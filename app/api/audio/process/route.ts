import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

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

    // Создаем инстанс FFmpeg
    const ffmpeg = new FFmpeg();
    
    // Загружаем WASM
    await ffmpeg.load({
      coreURL: await toBlobURL('/ffmpeg-core.wasm', 'text/wasm'),
      wasmURL: await toBlobURL('/ffmpeg.wasm', 'text/wasm'),
    });

    // Обрабатываем аудио
    await ffmpeg.writeFile('input.audio', new Uint8Array(audioData));
    await ffmpeg.exec([
      '-i', 'input.audio',
      '-t', '60',
      '-acodec', 'libmp3lame',
      '-b:a', '128k',
      '-ac', '2',
      '-ar', '44100',
      'output.mp3'
    ]);

    // Получаем обработанный файл
    const outputData = await ffmpeg.readFile('output.mp3');
    
    // Конвертируем Uint8Array в Buffer для Vercel Blob
    const buffer = Buffer.from(outputData as Uint8Array);
    
    // Загружаем обработанный файл обратно в Blob storage
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