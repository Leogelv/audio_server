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
  const logs: string[] = [];
  const log = (message: string) => {
    console.log(message);
    logs.push(message);
  };

  try {
    log('Starting audio processing...');
    
    // Получаем файлы из формы
    const formData = await request.formData();
    const voiceTrack = formData.get('voice_track');
    const audioTrack = formData.get('audio_track');
    const fileName = formData.get('name') || 'mixed';

    log(`Files received: ${JSON.stringify({
      voiceTrack: voiceTrack ? 'present' : 'missing',
      audioTrack: audioTrack ? 'present' : 'missing',
      fileName
    })}`);

    if (!voiceTrack || !audioTrack) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Both voice_track and audio_track are required',
          logs
        },
        { status: 400 }
      );
    }

    // Создаем временные пути для файлов
    const voicePath = join(tmpdir(), `voice-${Date.now()}.mp3`);
    const audioPath = join(tmpdir(), `audio-${Date.now()}.mp3`);
    const outputPath = join(tmpdir(), `output-${Date.now()}.mp3`);

    log(`Temp paths created: ${JSON.stringify({ voicePath, audioPath, outputPath })}`);

    try {
      // Сохраняем файлы
      const voiceBuffer = Buffer.from(await (voiceTrack as File).arrayBuffer());
      const audioBuffer = Buffer.from(await (audioTrack as File).arrayBuffer());
      
      log(`Buffers created: ${JSON.stringify({
        voiceSize: voiceBuffer.length,
        audioSize: audioBuffer.length
      })}`);

      await writeFile(voicePath, voiceBuffer);
      await writeFile(audioPath, audioBuffer);
      
      log('Files saved successfully');
    } catch (error) {
      log(`Error saving files: ${error}`);
      throw error;
    }

    log('Starting FFmpeg processing...');

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
          // Обрабатываем мокрый сигнал (реверб)
          '[wet]volume=-14dB,aecho=0.9:0.8:900|1200|1800:0.6|0.4|0.3,highpass=f=200[reverb]',
          // Микшируем сухой сигнал с ревербом
          '[dry][reverb]amix=inputs=2:weights=1 0.65[voice_delayed]',
          // Добавляем задержку в 12 секунд
          '[voice_delayed]adelay=12000|12000[voice_mixed]',
          // Добавляем финальное усиление голоса
          '[voice_mixed]volume=-5dB,asetrate=44100*0.95,aresample=44100[voice]',
          // Обрабатываем музыку
          '[1:a]volume=-24dB,atrim=0:378,asetpts=PTS-STARTPTS[audio_trimmed]',
          // Добавляем фейд в конце (15 секунд)
          '[audio_trimmed]afade=t=out:st=363:d=15[music]',
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

      log('FFmpeg command started');

      let lastProgress = 0;
      ffmpeg.stdout.on('data', (data) => {
        const output = data.toString();
        log(`FFmpeg stdout: ${output}`);
        const match = output.match(/time=(\d+):(\d+):(\d+\.\d+)/);
        if (match) {
          const [, hours, minutes, seconds] = match;
          const currentTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
          if (currentTime - lastProgress >= 30) {
            log(`Processing progress: ${Math.floor(currentTime)}s`);
            lastProgress = currentTime;
          }
        }
      });

      ffmpeg.stderr.on('data', (data) => {
        log(`FFmpeg stderr: ${data}`);
      });

      ffmpeg.on('close', (code) => {
        log(`FFmpeg process closed with code: ${code}`);
        if (code === 0) {
          resolve(null);
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        log(`FFmpeg process error: ${error}`);
        reject(error);
      });
    });

    log('FFmpeg processing complete, reading output file...');

    try {
      // Проверяем существование файла
      const stats = await readFile(outputPath);
      log(`Output file stats: ${JSON.stringify({
        size: stats.length,
        exists: true
      })}`);

      // Читаем обработанный файл
      const outputBuffer = await readFile(outputPath);
      log(`Output file read successfully, size: ${outputBuffer.length}`);

      // Удаляем временные файлы
      await Promise.all([
        unlink(voicePath).catch((e) => log(`Error deleting voice file: ${e}`)),
        unlink(audioPath).catch((e) => log(`Error deleting audio file: ${e}`)),
        unlink(outputPath).catch((e) => log(`Error deleting output file: ${e}`))
      ]);

      log('Temporary files cleaned up');

      // Отправляем файл
      return new Response(outputBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': `attachment; filename=${fileName}.mp3`,
          'Content-Length': outputBuffer.length.toString(),
          'X-Processing-Logs': JSON.stringify(logs)
        }
      });
    } catch (error) {
      log(`Error reading output file: ${error}`);
      throw error;
    }

  } catch (error) {
    log(`Error processing audio: ${error}`);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        stack: error instanceof Error ? error.stack : undefined,
        logs
      },
      { status: 500 }
    );
  }
} 