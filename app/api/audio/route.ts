import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { NextRequest, NextResponse } from 'next/server';

// Максимальный размер файла (25MB)
const MAX_FILE_SIZE = 25 * 1024 * 1024;

// Конфигурация для Edge Runtime
export const config = {
  runtime: 'edge',
  api: {
    bodyParser: false,
    responseLimit: false,
  },
  maxDuration: 300, // 5 минут на обработку
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
  const startTime = Date.now();
  
  try {
    // CORS заголовки для POST запроса
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Получаем файл из формы
    const data = await request.formData();
    const file = data.get('audio_file');

    if (!file) {
      const error = 'No file uploaded';
      console.error(error);
      return NextResponse.json(
        { 
          success: false,
          error,
          metrics: {
            processingTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            fileType: null,
            fileSize: null
          }
        },
        { 
          status: 400,
          headers 
        }
      );
    }

    // Проверяем размер файла
    const fileSize = (file as File).size;
    if (fileSize > MAX_FILE_SIZE) {
      const error = `File size exceeds limit (${Math.floor(MAX_FILE_SIZE / (1024 * 1024))}MB)`;
      console.error(error);
      return NextResponse.json(
        {
          success: false,
          error,
          metrics: {
            processingTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            fileType: (file as File).type,
            fileSize: `${(fileSize / (1024 * 1024)).toFixed(2)}MB`
          }
        },
        {
          status: 413,
          headers
        }
      );
    }

    // Проверяем тип файла
    const fileType = (file as File).type;
    if (!fileType.startsWith('audio/')) {
      const error = 'Invalid file type. Please upload an audio file.';
      console.error(error);
      return NextResponse.json(
        { 
          success: false,
          error,
          metrics: {
            processingTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            fileType,
            fileSize: `${(fileSize / (1024 * 1024)).toFixed(2)}MB`
          }
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

    // Обрезаем до 1 минуты и конвертируем в mp3 с пониженным битрейтом
    await ffmpeg.exec([
      '-i', 'input.audio',
      '-t', '60',
      '-acodec', 'libmp3lame',
      '-b:a', '128k', // Уменьшаем битрейт до 128kbps
      '-ac', '2',     // Стерео
      '-ar', '44100', // Частота дискретизации 44.1kHz
      'output.mp3'
    ]);

    // Получаем результат
    const outputData = await ffmpeg.readFile('output.mp3');
    
    // Отправляем файл с метриками в заголовках
    const processingTime = Date.now() - startTime;
    return new Response(outputData, {
      headers: {
        ...headers,
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'attachment; filename=trimmed.mp3',
        'X-Processing-Time': processingTime.toString(),
        'X-File-Type': fileType,
        'X-File-Size': `${(fileSize / (1024 * 1024)).toFixed(2)}MB`,
        'X-Processing-Status': 'success'
      }
    });

  } catch (error) {
    console.error('Error processing audio:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metrics: {
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          fileType: 'unknown',
          fileSize: 'unknown'
        }
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