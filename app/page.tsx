'use client';

import { upload } from '@vercel/blob/client';
import { useState, useRef } from 'react';

export default function Home() {
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inputFileRef.current?.files?.[0]) return;

    try {
      setLoading(true);
      setError(null);

      const file = inputFileRef.current.files[0];
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      });

      setProcessedUrl(blob.url);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 flex flex-col items-center justify-center bg-gradient-to-b from-blue-500 to-purple-600">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          🎵 Audio Trimmer
        </h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Select Audio File
            </label>
            <input
              type="file"
              accept="audio/*"
              ref={inputFileRef}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-md text-white font-medium ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            } transition-colors`}
          >
            {loading ? 'Processing...' : 'Upload & Process'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {processedUrl && (
          <div className="mt-4 p-4 bg-green-100 text-green-700 rounded-md">
            <p className="font-medium mb-2">Audio processed successfully!</p>
            <a
              href={processedUrl}
              className="text-blue-600 hover:text-blue-800 underline break-all"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download processed audio
            </a>
          </div>
        )}
      </div>
    </main>
  );
} 