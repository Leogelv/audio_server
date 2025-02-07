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
    const reverbPath = join(tmpdir(), `reverb-${Date.now()}.wav`); // Для SoX реверба

    console.log('Processing started:', { voicePath, audioPath, outputPath, reverbPath });

    // Сохраняем файлы
    await writeFile(voicePath, Buffer.from(await (voiceTrack as File).arrayBuffer()));
    await writeFile(audioPath, Buffer.from(await (audioTrack as File).arrayBuffer()));

    console.log('Files saved, starting SoX processing...');

    // Сначала обрабатываем голос через SoX для реверба
    await new Promise((resolve, reject) => {
      const sox = spawn('sox', [
        voicePath,
        reverbPath,
        'reverb',
        '90',     // Чуть меньше реверберации для экономии ресурсов
        '30',     // Средний HF демпинг
        '75',     // Средний размер
        '100',    // Максимальная стерео база
        '0',      // Без пре-делея
        '0.7',    // Стандартный микс
        'highpass', '250',  // Срез низов
        'treble', '+3',    // Умеренное усиление верхов
        'gain', '-1'      // Контроль громкости
      ]);

      sox.stderr.on('data', (data) => {
        console.log(`sox: ${data}`);
      });

      sox.on('close', (code) => {
        if (code === 0) {
          resolve(null);
        } else {
          reject(new Error(`SoX process exited with code ${code}`));
        }
      });

      sox.on('error', (error) => {
        reject(error);
      });
    });

    console.log('SoX processing complete, starting FFmpeg...');

    // Теперь обрабатываем через ffmpeg
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        // Входные файлы
        '-i', voicePath,
        '-i', reverbPath,
        '-i', audioPath,
        
        // Фильтры
        '-filter_complex',
        [
          // Замедляем оригинальный голос
          '[0:a]atempo=0.85[voice_slow]',
          // Замедляем реверб из SoX
          '[1:a]atempo=0.85[reverb_slow]',
          // Обрабатываем сухой сигнал (оптимизированный EQ)
          '[voice_slow]equalizer=f=250:t=h:w=1:g=-6,equalizer=f=3000:t=h:w=1:g=-8,equalizer=f=8000:t=h:w=1:g=-12[voice_eq]',
          '[voice_eq]compand=0.3|0.3:1|1:-90/-60|-60/-40|-40/-30|-20/-20:6:0:-90:0.2[voice_comp]',
          // Микшируем с замедленным ревербом
          '[voice_comp][reverb_slow]amix=inputs=2:weights=1 0.65[voice_mixed]',
          // Добавляем задержку
          '[voice_mixed]adelay=12000|12000,volume=2dB[voice]',
          // Обрабатываем музыку (оптимизированная обработка)
          '[2:a]volume=-24dB,atrim=0:445[audio_trimmed]',
          '[audio_trimmed]afade=t=out:st=430:d=15[music]',
          // Микшируем треки и добавляем лимитер
          '[voice][music]amix=inputs=2:duration=longest:dropout_transition=0,volume=16dB,alimiter=level_in=1:level_out=1:limit=0.7:attack=5:release=50[out]'
        ].join(';'),
        
        // Выходные параметры (оптимизированные)
        '-map', '[out]',
        '-acodec', 'libmp3lame',
        '-q:a', '2',  // Чуть меньше качество для экономии
        '-b:a', '256k',  // Меньший битрейт
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
      unlink(outputPath).catch(() => {}),
      unlink(reverbPath).catch(() => {})
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