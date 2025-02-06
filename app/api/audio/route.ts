import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Отключаем Edge Runtime для этого роута
export const runtime = 'nodejs';

// Конфигурация для обработки больших файлов
export const config = {
  api: {
    bodyParser: false,
    responseLimit: '50mb',
    maxDuration: 300,
  },
}

export async function POST(request: NextRequest) {
  try {
    // Получаем файл из формы
    const formData = await request.formData();
    const file = formData.get('audio_file');

    if (!file) {
      return NextResponse.json(
        { 
          success: false,
          error: 'No file uploaded',
        },
        { status: 400 }
      );
    }

    // Создаем временные пути для файлов
    const inputPath = join(tmpdir(), `input-${Date.now()}.mp3`);
    const outputPath = join(tmpdir(), `output-${Date.now()}.mp3`);

    // Сохраняем входной файл
    const buffer = Buffer.from(await (file as File).arrayBuffer());
    await writeFile(inputPath, buffer);

    // Обрабатываем аудио
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('mp3')
        .duration(60)
        .audioCodec('libmp3lame')
        .audioBitrate(128)
        .audioChannels(2)
        .audioFrequency(44100)
        .on('end', async () => {
          try {
            // Читаем обработанный файл
            const outputBuffer = await readFile(outputPath);
            
            // Отправляем файл
            resolve(new Response(outputBuffer, {
              headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Disposition': 'attachment; filename=trimmed.mp3',
              }
            }));

            // Удаляем временные файлы
            await Promise.all([
              unlink(inputPath).catch(() => {}),
              unlink(outputPath).catch(() => {})
            ]);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error: Error) => {
          reject(error);
        })
        .save(outputPath);
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