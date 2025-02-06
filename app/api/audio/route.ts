import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { NextRequest, NextResponse } from 'next/server';

// Конфигурация для Edge Runtime
export const config = {
  runtime: 'edge',
  api: {
    bodyParser: false,
    responseLimit: '10mb'
  },
}

// Обработчик CORS для OPTIONS запросов
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    // CORS заголовки для POST запроса
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Получаем файл из формы
    const data = await request.formData();
    const file = data.get('audio_file'); // Изменили имя поля для файла

    if (!file) {
      return NextResponse.json(
        { 
          success: false,
          error: 'No file uploaded' 
        },
        { 
          status: 400,
          headers 
        }
      );
    }

    // Проверяем тип файла
    const fileType = (file as File).type;
    if (!fileType.startsWith('audio/')) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid file type. Please upload an audio file.' 
        },
        { 
          status: 400,
          headers 
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

    // Обрезаем до 1 минуты и конвертируем в mp3
    await ffmpeg.exec([
      '-i', 'input.audio',
      '-t', '60',
      '-acodec', 'libmp3lame',
      '-q:a', '2',
      'output.mp3'
    ]);

    // Получаем результат
    const outputData = await ffmpeg.readFile('output.mp3');
    
    // Отправляем файл
    return new Response(outputData, {
      headers: {
        ...headers,
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'attachment; filename=trimmed.mp3'
      }
    });

  } catch (error) {
    console.error('Error processing audio:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
} 