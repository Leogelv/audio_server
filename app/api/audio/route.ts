import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
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

    // Обрабатываем аудио через ffmpeg CLI
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-t', '60',
        '-acodec', 'libmp3lame',
        '-b:a', '128k',
        '-ac', '2',
        '-ar', '44100',
        outputPath
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(null);
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}`));
        }
      });

      ffmpeg.on('error', reject);
    });

    // Читаем обработанный файл
    const outputBuffer = await readFile(outputPath);

    // Удаляем временные файлы
    await Promise.all([
      unlink(inputPath).catch(() => {}),
      unlink(outputPath).catch(() => {})
    ]);

    // Отправляем файл
    return new Response(outputBuffer, {
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