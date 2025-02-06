import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname: string) => {
        // Здесь можно добавить проверку авторизации
        return {
          allowedContentTypes: ['audio/*'],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // После успешной загрузки отправляем файл на обработку
        try {
          const response = await fetch(`${process.env.VERCEL_URL}/api/audio/process`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: blob.url }),
          });

          if (!response.ok) {
            throw new Error('Failed to process audio');
          }

          return { success: true, url: blob.url };
        } catch (error) {
          console.error('Error processing audio:', error);
          throw error;
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
} 