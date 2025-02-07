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
          // Разделяем на сухой и мокрый сигналы
          '[0:a]asplit=2[dry][wet]',
          // Замедляем оба сигнала через atempo (более качественное замедление)
          '[dry]atempo=0.85[dry_slow]',
          '[wet]atempo=0.85[wet_slow]',
          // Обрабатываем мокрый сигнал (усиленный мягкий реверб)
          '[wet_slow]volume=-6dB,aecho=0.8:0.88:60|90|120:0.5|0.4|0.3[echo]',
          '[echo]aecho=0.7:0.8:400|700|1000|1300|1600:0.5|0.4|0.3|0.2|0.15,highpass=f=150,lowpass=f=4000[reverb]',
          // Микшируем сухой сигнал с эффектами
          '[dry_slow][reverb]amix=inputs=2:weights=1 0.55[voice_delayed]',
          // Добавляем задержку в 12 секунд
          '[voice_delayed]adelay=12000|12000[voice_mixed]',
          // Добавляем финальное усиление голоса
          '[voice_mixed]volume=2dB[voice]',
          // Обрабатываем музыку (увеличиваем длину из-за замедления войса)
          '[1:a]volume=-24dB,atrim=0:445,asetpts=PTS-STARTPTS[audio_trimmed]',
          // Добавляем фейд в конце (15 секунд)
          '[audio_trimmed]afade=t=out:st=430:d=15[music]',
          // Микшируем треки и добавляем лимитер
          '[voice][music]amix=inputs=2:duration=longest:dropout_transition=0,volume=18dB,alimiter=level_in=1:level_out=1:limit=0.7:attack=5:release=50[out]'
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