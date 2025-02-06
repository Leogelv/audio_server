import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ['audio/*'],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB
        };
      },
      onUploadCompleted: async ({ blob }) => {
        try {
          // Отправляем файл на обработку
          const response = await fetch(`${process.env.VERCEL_URL}/api/audio/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: blob.url }),
          });

          if (!response.ok) {
            throw new Error('Failed to process audio');
          }

          const result = await response.json();
          console.log('Processing completed:', result);
        } catch (error) {
          console.error('Processing error:', error);
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    );
  }
} 