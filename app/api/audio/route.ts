import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Отключаем Edge Runtime для этого роута
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    // Получаем файлы из формы
    const formData = await request.formData();
    const voiceTrack = formData.get('voice_track');
    const audioTrack = formData.get('audio_track');

    if (!voiceTrack || !audioTrack) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Both voice_track and audio_track are required',
        },
        { status: 400 }
      );
    }

    // Создаем временные пути для файлов
    const voicePath = join(tmpdir(), `voice-${Date.now()}.mp3`);
    const audioPath = join(tmpdir(), `audio-${Date.now()}.mp3`);
    const outputPath = join(tmpdir(), `output-${Date.now()}.mp3`);

    console.log('Processing started:', { voicePath, audioPath, outputPath });

    // Сохраняем файлы
    await writeFile(voicePath, Buffer.from(await (voiceTrack as File).arrayBuffer()));
    await writeFile(audioPath, Buffer.from(await (audioTrack as File).arrayBuffer()));

    console.log('Files saved, starting FFmpeg...');

    // Обрабатываем аудио через ffmpeg CLI
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        // Входные файлы
        '-i', voicePath,
        '-i', audioPath,
        
        // Фильтры
        '-filter_complex',
        [
          // Регулируем громкость треков и добавляем реверб на голос
          '[0:a]volume=7dB,aecho=0.8:0.88:60:0.4[voice]',
          '[1:a]volume=-14dB,atrim=0:360,asetpts=PTS-STARTPTS[audio_trimmed]',
          // Добавляем фейд в конце (15 секунд)
          '[audio_trimmed]afade=t=out:st=345:d=15[music]',
          // Микшируем треки и усиливаем общий микс
          '[voice][music]amix=inputs=2:duration=first:dropout_transition=0,volume=5dB[out]'
        ].join(';'),
        
        // Выходные параметры
        '-map', '[out]',
        '-acodec', 'libmp3lame',
        '-q:a', '0',
        '-b:a', '320k',
        '-ac', '2',
        '-ar', '44100',
        // Добавляем прогресс
        '-progress', 'pipe:1',
        outputPath
      ]);

      let lastProgress = 0;
      ffmpeg.stdout.on('data', (data) => {
        const match = data.toString().match(/time=(\d+):(\d+):(\d+\.\d+)/);
        if (match) {
          const [, hours, minutes, seconds] = match;
          const currentTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
          if (currentTime - lastProgress >= 30) {
            console.log(`Processing progress: ${Math.floor(currentTime)}s`);
            lastProgress = currentTime;
          }
        }
      });

      ffmpeg.stderr.on('data', (data) => {
        console.log(`ffmpeg: ${data}`);
      });

      ffmpeg.on('close', (code) => {
        console.log('FFmpeg finished with code:', code);
        if (code === 0) {
          resolve(null);
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        console.error('FFmpeg error:', error);
        reject(error);
      });
    });

    console.log('FFmpeg processing complete, reading output file...');

    // Читаем обработанный файл
    const outputBuffer = await readFile(outputPath);

    console.log('Output file read, size:', outputBuffer.length);

    // Удаляем временные файлы
    await Promise.all([
      unlink(voicePath).catch(() => {}),
      unlink(audioPath).catch(() => {}),
      unlink(outputPath).catch(() => {})
    ]);

    console.log('Temporary files cleaned up, sending response...');

    // Отправляем файл
    return new Response(outputBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'attachment; filename=mixed.mp3',
        'Content-Length': outputBuffer.length.toString(),
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