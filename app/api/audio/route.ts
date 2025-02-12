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
    const fileName = formData.get('name') || 'mixed';

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
    const voiceWetPath = join(tmpdir(), `voice-wet-${Date.now()}.mp3`);
    const voiceDryPath = join(tmpdir(), `voice-dry-${Date.now()}.mp3`);
    const audioPath = join(tmpdir(), `audio-${Date.now()}.mp3`);
    const outputPath = join(tmpdir(), `output-${Date.now()}.mp3`);

    console.log('Processing started:', { voicePath, voiceWetPath, voiceDryPath, audioPath, outputPath });

    // Сохраняем файлы
    await writeFile(voicePath, Buffer.from(await (voiceTrack as File).arrayBuffer()));
    await writeFile(audioPath, Buffer.from(await (audioTrack as File).arrayBuffer()));

    console.log('Files saved, processing wet voice with sox...');

    // Обрабатываем мокрый сигнал через sox
    await new Promise((resolve, reject) => {
      const sox = spawn('sox', [
        voicePath,
        voiceWetPath,
        'tempo', '0.93',
        'highpass', '600',
        'equalizer', '6000', '3q', '-12',
        'equalizer', '8000', '2q', '-8',
        'reverb', '90', '40', '100', '100', '20', '0',
        'remix', '1',
        'reverb', '-w',
        'highpass', '800'
      ]);

      sox.stderr.on('data', (data) => {
        console.log(`sox wet: ${data}`);
      });

      sox.on('close', (code) => {
        if (code === 0) {
          resolve(null);
        } else {
          reject(new Error(`Sox wet process exited with code ${code}`));
        }
      });

      sox.on('error', (error) => {
        console.error('Sox wet error:', error);
        reject(error);
      });
    });

    console.log('Processing dry voice with sox...');

    // Обрабатываем сухой сигнал через sox
    await new Promise((resolve, reject) => {
      const sox = spawn('sox', [
        voicePath,
        voiceDryPath,
        'tempo', '0.93',
        'equalizer', '6000', '3q', '-15',
        'equalizer', '8000', '2q', '-12'
      ]);

      sox.stderr.on('data', (data) => {
        console.log(`sox dry: ${data}`);
      });

      sox.on('close', (code) => {
        if (code === 0) {
          resolve(null);
        } else {
          reject(new Error(`Sox dry process exited with code ${code}`));
        }
      });

      sox.on('error', (error) => {
        console.error('Sox dry error:', error);
        reject(error);
      });
    });

    console.log('Voice processed with sox, starting FFmpeg...');

    // Сначала создаем основной микс
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        // Входные файлы
        '-i', voiceDryPath,
        '-i', voiceWetPath,
        '-i', audioPath,
        
        // Фильтры
        '-filter_complex',
        [
          // Регулируем громкость треков и синхронизируем
          '[0:a]volume=23[dry]',
          '[1:a]volume=26[wet]',
          '[dry][wet]amix=inputs=2:duration=first:dropout_transition=0:weights=3 1,adelay=15000|15000,volume=2[voice]',
          '[2:a]atrim=0:360,asetpts=PTS-STARTPTS,volume=-2[audio_trimmed]',
          // Добавляем фейд в конце (15 секунд)
          '[audio_trimmed]afade=t=out:st=345:d=15[music]',
          // Микшируем треки
          '[voice][music]amix=inputs=2:duration=first:dropout_transition=0[out]'
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

    // Читаем основной микс
    const outputBuffer = await readFile(outputPath);

    console.log('Output file read, size:', outputBuffer.length);

    // Удаляем временные файлы
    await Promise.all([
      unlink(voicePath).catch(() => {}),
      unlink(voiceWetPath).catch(() => {}),
      unlink(voiceDryPath).catch(() => {}),
      unlink(audioPath).catch(() => {}),
      unlink(outputPath).catch(() => {})
    ]);

    console.log('Temporary files cleaned up, sending response...');

    // Отправляем файл
    return new Response(outputBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `attachment; filename=${fileName}.mp3`,
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