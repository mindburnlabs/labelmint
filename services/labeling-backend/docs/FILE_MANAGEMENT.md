# File Management System

A comprehensive file management system with S3 integration, virus scanning, image processing, and extensive testing infrastructure.

## Features

### S3 Integration
- **Multipart Upload**: Support for large files with multipart upload capability
- **Presigned URLs**: Secure direct upload and download URLs
- **Multiple S3 Providers**: Compatible with AWS S3, MinIO, and other S3-compatible services
- **Automatic Failover**: Built-in error handling and retry mechanisms

### Image Processing Pipeline
- **Sharp.js Integration**: High-performance image processing
- **Format Conversion**: JPEG, PNG, WebP, GIF, TIFF, AVIF support
- **Resizing & Cropping**: Intelligent image resizing with multiple fit options
- **Thumbnail Generation**: Automatic thumbnail creation in multiple sizes
- **Optimization**: Web optimization with quality and compression settings
- **Metadata Stripping**: Automatic EXIF and metadata removal for privacy

### Security & Validation
- **ClamAV Integration**: Real-time virus scanning with configurable rules
- **File Type Validation**: Comprehensive MIME type and extension checking
- **Size Limits**: Configurable file size restrictions
- **Malicious Pattern Detection**: Heuristic scanning for embedded threats
- **Checksum Verification**: SHA-256 integrity checking

### Testing Infrastructure
- **Jest Unit Tests**: 80% code coverage requirement
- **Supertest API Tests**: Full API endpoint testing
- **Playwright E2E Tests**: Cross-browser end-to-end testing
- **Visual Regression**: Percy integration for visual testing
- **Load Testing**: k6 performance and stress testing

## API Endpoints

### Upload Operations

#### Single File Upload
```http
POST /api/files/upload
Content-Type: multipart/form-data

file: [File]
folder: [optional folder path]
processing: [JSON string with processing options]
```

#### Multiple File Upload
```http
POST /api/files/upload/multiple
Content-Type: multipart/form-data

files: [File array]
folder: [optional folder path]
```

#### Presigned Upload URL
```http
GET /api/files/upload/url?fileName=image.png&contentType=image/png&folder=uploads
```

#### Multipart Upload (Large Files)
```http
POST /api/files/upload/multipart/create
{
  "fileName": "large-video.mp4",
  "contentType": "video/mp4",
  "folder": "videos"
}

POST /api/files/upload/multipart/complete
{
  "uploadId": "upload-id",
  "key": "file-key",
  "parts": [
    { "PartNumber": 1, "ETag": "etag1" },
    { "PartNumber": 2, "ETag": "etag2" }
  ]
}
```

### File Operations

#### Download URL
```http
GET /api/files/download/url?key=uploads/image.png&expiresIn=3600
```

#### File Information
```http
GET /api/files/info/:key
```

#### List Files
```http
GET /api/files/list?prefix=uploads&maxKeys=100
```

#### Delete File
```http
DELETE /api/files/:key
```

### Image Processing

#### Process Existing Image
```http
POST /api/files/process/:key
{
  "format": "webp",
  "quality": 85,
  "width": 800,
  "height": 600,
  "stripMetadata": true
}
```

### Virus Scanner Management

#### Scanner Status
```http
GET /api/files/scanner/status
```

#### Update Virus Database
```http
POST /api/files/scanner/update-database
```

## Configuration

### Environment Variables

```bash
# S3 Configuration
AWS_REGION=us-east-1
AWS_S3_BUCKET=my-bucket
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_ENDPOINT=https://s3.amazonaws.com  # Optional, for MinIO
AWS_S3_FORCE_PATH_STYLE=false              # Optional, for MinIO

# Virus Scanner
VIRUS_SCANNER_ENABLED=true
CLAMAV_SOCKET_PATH=/var/run/clamav/clamd.sock
CLAMAV_HOST=localhost
CLAMAV_PORT=3310
CLAMAV_TIMEOUT=30000
CLAMAV_MAX_FILE_SIZE=104857600
CLAMAV_SKIP_EXTENSIONS=.jpg,.png,.gif

# File Validation
MAX_FILE_SIZE=52428800                    # 50MB
ALLOWED_MIME_TYPES=image/jpeg,image/png,application/pdf
ALLOWED_EXTENSIONS=.jpg,.jpeg,.png,.pdf
BLOCKED_EXTENSIONS=.exe,.bat,.cmd,.com
REQUIRE_FILE_CHECKSUM=true

# Image Processing
IMAGE_PROCESSING_ENABLED=true
AUTO_OPTIMIZE_IMAGES=true
GENERATE_THUMBNAILS=true
THUMBNAIL_SMALL_WIDTH=150
THUMBNAIL_SMALL_HEIGHT=150
THUMBNAIL_MEDIUM_WIDTH=300
THUMBNAIL_MEDIUM_HEIGHT=300
THUMBNAIL_LARGE_WIDTH=600
THUMBNAIL_LARGE_HEIGHT=600
```

## Usage Examples

### Basic File Upload (JavaScript)

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('folder', 'user-uploads');
formData.append('processing', JSON.stringify({
  autoOptimize: true,
  generateThumbnails: true
}));

const response = await fetch('/api/files/upload', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
console.log('Uploaded file:', result.file);
```

### Presigned URL Upload (React)

```jsx
import { useState } from 'react';

function FileUploader() {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file) => {
    // Get presigned URL
    const urlResponse = await fetch(
      `/api/files/upload/url?fileName=${file.name}&contentType=${file.type}`
    );
    const { uploadUrl, key } = await urlResponse.json();

    // Upload directly to S3
    setUploading(true);
    await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });
    setUploading(false);

    console.log('File uploaded with key:', key);
  };

  return (
    <input
      type="file"
      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
      disabled={uploading}
    />
  );
}
```

### Image Processing

```javascript
// Process an uploaded image
const processImage = async (fileKey) => {
  const response = await fetch(`/api/files/process/${fileKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      format: 'webp',
      quality: 90,
      width: 1200,
      height: 800,
      stripMetadata: true,
    }),
  });

  const result = await response.json();
  return result.processed;
};
```

## Testing

### Run All Tests
```bash
npm run test:all
```

### Unit Tests with Coverage
```bash
npm run test:unit:coverage
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

### Visual Regression Tests
```bash
npm run test:visual
```

### Load Testing
```bash
npm run test:load
npm run test:load:stress
```

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client App    │───▶│   Files API      │───▶│     S3/MinIO    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  Virus Scanner   │
                       │     (ClamAV)     │
                       └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │ Image Processor  │
                       │    (Sharp.js)    │
                       └──────────────────┘
```

## Security Considerations

1. **Access Control**: Implement proper authentication and authorization
2. **Input Validation**: All files are validated for type, size, and content
3. **Virus Scanning**: Automated scanning of all uploads
4. **Metadata Removal**: EXIF data stripped from images
5. **Presigned URLs**: Temporary, secure access to files
6. **Rate Limiting**: Implement rate limiting on upload endpoints

## Performance Optimizations

1. **Multipart Upload**: Efficient handling of large files
2. **Image Optimization**: Automatic compression and format conversion
3. **Thumbnail Generation**: Multiple sizes generated asynchronously
4. **Caching**: CDN integration for static assets
5. **Concurrent Processing**: Parallel image processing
6. **Lazy Loading**: Generate thumbnails on demand

## Monitoring

### Metrics to Track
- Upload success/failure rates
- File size distribution
- Processing times
- Storage usage
- Virus detection rates
- Error rates by type

### Health Checks
```bash
curl http://localhost:3001/health
```

### Scanner Status
```bash
curl http://localhost:3001/api/files/scanner/status
```

## Troubleshooting

### Common Issues

1. **Upload Fails**
   - Check S3 credentials
   - Verify bucket permissions
   - Check file size limits

2. **Virus Scanner Errors**
   - Ensure ClamAV is running
   - Check socket permissions
   - Update virus database

3. **Image Processing Errors**
   - Verify Sharp.js dependencies
   - Check available memory
   - Review image format support

4. **Performance Issues**
   - Monitor S3 response times
   - Check processing queue length
   - Review resource utilization

## License

This file management system is part of the Telegram Labeling Platform project.