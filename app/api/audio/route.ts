import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { NextRequest, NextResponse } from 'next/server';

// Отключаем Edge Runtime для этого роута
export const runtime = 'nodejs';

// Конфигурация для обработки больших файлов
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
}

export async function POST(request: NextRequest) {
  try {
    // Получаем файл из формы
    const data = await request.formData();
    const file = data.get('audio_file');

    if (!file) {
      return NextResponse.json(
        { 
          success: false,
          error: 'No file uploaded',
        },
        { 
          status: 400,
        }
      );
    }

    // Создаем инстанс FFmpeg
    const ffmpeg = new FFmpeg();
    
    // Загружаем WASM
    await ffmpeg.load({
      coreURL: await toBlobURL('/ffmpeg-core.wasm', 'text/wasm'),
      wasmURL: await toBlobURL('/ffmpeg.wasm', 'text/wasm'),
    });

    // Читаем файл
    const inputBuffer = await (file as File).arrayBuffer();
    await ffmpeg.writeFile('input.audio', new Uint8Array(inputBuffer));

    // Обрезаем до 1 минуты и конвертируем в mp3 с пониженным битрейтом
    await ffmpeg.exec([
      '-i', 'input.audio',
      '-t', '60',
      '-acodec', 'libmp3lame',
      '-b:a', '128k',
      '-ac', '2',
      '-ar', '44100',
      'output.mp3'
    ]);

    // Получаем результат
    const outputData = await ffmpeg.readFile('output.mp3');
    
    // Отправляем файл
    return new Response(outputData, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'attachment; filename=trimmed.mp3',
      }
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