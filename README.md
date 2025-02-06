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

#### Response
- Success:
  - Status: 200
  - Content-Type: `audio/mpeg`
  - Body: Trimmed MP3 file

- Error:
  - Status: 400/500
  - Content-Type: `application/json`
  - Body:
    ```json
    {
      "success": false,
      "error": "Error message"
    }
    ```

## Bubble.io Integration

To use this API in Bubble.io:

1. Use the "API Connector" plugin
2. Create a new API call with:
   - Method: POST
   - URL: `https://your-deployed-url.vercel.app/api/audio`
   - Body type: Form Data
   - Add field: `audio_file` (File type)

3. In your Bubble workflow:
   - Trigger your action (e.g., button click)
   - Add "Make API call"
   - Select your configured API
   - For the `audio_file` parameter, use a file input or uploaded file from your app

The API will return the trimmed audio file that you can then save or play in your Bubble app.
