# Audio Trimmer API 🎵

Simple API service that trims audio files to 1 minute and converts them to MP3 format.

## API Endpoints

### POST /api/audio

Trims an audio file to 1 minute and converts it to MP3 format.

#### Request
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `audio_file`: Audio file (any format supported by FFmpeg)
- Limits:
  - Maximum file size: 25MB
  - Processing timeout: 5 minutes
  - Output format: MP3 (128kbps, 44.1kHz, Stereo)

#### Response
- Success:
  - Status: 200
  - Content-Type: `audio/mpeg`
  - Body: Trimmed MP3 file
  - Headers:
    - `X-Processing-Time`: Processing time in milliseconds
    - `X-File-Type`: Original file type
    - `X-File-Size`: Original file size
    - `X-Processing-Status`: Processing status

- Error:
  - Status: 400/413/500
  - Content-Type: `application/json`
  - Body:
    ```json
    {
      "success": false,
      "error": "Error message",
      "metrics": {
        "processingTime": 123,
        "timestamp": "2024-01-16T12:00:00.000Z",
        "fileType": "audio/mpeg",
        "fileSize": "10.5MB"
      }
    }
    ```

## Bubble.io Integration

To use this API in Bubble.io:

1. Use the "API Connector" plugin
2. Create a new API call with:
   - Method: POST
   - URL: `https://audio-server-beige.vercel.app/api/audio`
   - Body type: Form Data
   - Add field: `audio_file` (File type)

3. In your Bubble workflow:
   - Trigger your action (e.g., button click)
   - Add "Make API call"
   - Select your configured API
   - For the `audio_file` parameter, use a file input or uploaded file from your app
   - Make sure your audio file is under 25MB

### Important Notes
- The API will trim any audio file to 1 minute
- The output is always MP3 format with 128kbps bitrate
- Files larger than 25MB will be rejected with 413 status
- Processing timeout is set to 5 minutes
- CORS is enabled for all origins
