/**
 * File Processing Web Worker for LabelMint PWA
 * Handles bulk file uploads, image processing, and data extraction
 */

// Import libraries if needed
// importScripts('https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js');

self.onmessage = async function(e) {
  const { type, files, options, id } = e.data;

  try {
    switch (type) {
      case 'PROCESS_FILES':
        await processFiles(files, options, id);
        break;
      case 'COMPRESS_IMAGE':
        await compressImage(options, id);
        break;
      case 'EXTRACT_TEXT':
        await extractText(options, id);
        break;
      case 'VALIDATE_DATA':
        await validateData(options, id);
        break;
      default:
        throw new Error(`Unknown worker task type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      id,
      error: error.message
    });
  }
};

/**
 * Process multiple files
 */
async function processFiles(files, options, id) {
  const results = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const file = files[i];

    try {
      // Report progress
      self.postMessage({
        type: 'PROGRESS',
        id,
        progress: Math.round((i / total) * 100)
      });

      const result = await processSingleFile(file, options);
      results.push(result);

    } catch (error) {
      results.push({
        file: file.name,
        error: error.message
      });
    }
  }

  self.postMessage({
    type: 'FILES_PROCESSED',
    id,
    results
  });
}

/**
 * Process a single file
 */
async function processSingleFile(file, options) {
  const result = {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified
  };

  // Handle different file types
  if (file.type.startsWith('image/')) {
    if (options.compress) {
      result.compressed = await compressImageFile(file, options);
    }
    if (options.extractMetadata) {
      result.metadata = await extractImageMetadata(file);
    }
    if (options.generateThumbnail) {
      result.thumbnail = await generateThumbnail(file);
    }
  } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
    if (options.validate) {
      result.validation = await validateCSV(file);
    }
    if (options.preview) {
      result.preview = await generateCSVPreview(file);
    }
  } else if (file.type === 'application/json' || file.name.endsWith('.json')) {
    if (options.validate) {
      result.validation = await validateJSON(file);
    }
  } else if (file.type.startsWith('text/')) {
    if (options.preview) {
      result.preview = await generateTextPreview(file);
    }
  }

  // Calculate checksum for integrity
  result.checksum = await calculateChecksum(file);

  return result;
}

/**
 * Compress image file
 */
async function compressImageFile(file, options) {
  return new Promise((resolve) => {
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.onload = () => {
      // Calculate new dimensions
      const maxWidth = options.maxWidth || 1920;
      const maxHeight = options.maxHeight || 1080;
      let { width, height } = img;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      // Resize canvas
      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);

      canvas.convertToBlob({
        type: options.format || 'image/jpeg',
        quality: options.quality || 0.8
      }).then(blob => {
        resolve({
          originalSize: file.size,
          compressedSize: blob.size,
          width,
          height,
          compressionRatio: ((file.size - blob.size) / file.size * 100).toFixed(2) + '%'
        });
      });
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Extract image metadata
 */
async function extractImageMetadata(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        aspectRatio: (img.naturalWidth / img.naturalHeight).toFixed(2)
      });
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Generate thumbnail
 */
async function generateThumbnail(file) {
  return new Promise((resolve) => {
    const canvas = new OffscreenCanvas(200, 200);
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.onload = () => {
      // Calculate thumbnail dimensions maintaining aspect ratio
      const size = 200;
      let { width, height } = img;
      const aspectRatio = width / height;

      if (aspectRatio > 1) {
        width = size;
        height = size / aspectRatio;
      } else {
        height = size;
        width = size * aspectRatio;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw thumbnail
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.convertToBlob({
        type: 'image/jpeg',
        quality: 0.7
      }).then(blob => {
        blob.arrayBuffer().then(buffer => {
          resolve({
            size: blob.size,
            width,
            height,
            data: Array.from(new Uint8Array(buffer))
          });
        });
      });
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Validate CSV file
 */
async function validateCSV(file) {
  const text = await file.text();
  const lines = text.split('\n').filter(line => line.trim());

  const validation = {
    rows: lines.length,
    columns: 0,
    hasHeader: false,
    errors: [],
    sampleRows: []
  };

  if (lines.length > 0) {
    // Check if first row looks like headers
    const firstRow = lines[0].split(',');
    validation.hasHeader = isNaN(firstRow[0]);
    validation.columns = firstRow.length;

    // Validate rows
    lines.slice(0, 5).forEach((line, index) => {
      const columns = line.split(',');
      if (columns.length !== validation.columns) {
        validation.errors.push(`Row ${index + 1} has ${columns.length} columns (expected ${validation.columns})`);
      }
    });

    // Sample rows for preview
    validation.sampleRows = lines.slice(0, 3);
  }

  return validation;
}

/**
 * Generate CSV preview
 */
async function generateCSVPreview(file) {
  const text = await file.text();
  const lines = text.split('\n').slice(0, 10); // First 10 lines
  return {
    totalLines: text.split('\n').length,
    preview: lines,
    estimatedSize: text.length
  };
}

/**
 * Validate JSON file
 */
async function validateJSON(file) {
  const text = await file.text();

  try {
    const data = JSON.parse(text);
    return {
      valid: true,
      type: Array.isArray(data) ? 'array' : typeof data,
      size: text.length,
      keys: typeof data === 'object' && !Array.isArray(data) ? Object.keys(data) : []
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
      size: text.length
    };
  }
}

/**
 * Generate text preview
 */
async function generateTextPreview(file) {
  const text = await file.text();
  return {
    size: text.length,
    lines: text.split('\n').length,
    preview: text.substring(0, 500) // First 500 characters
  };
}

/**
 * Calculate file checksum
 */
async function calculateChecksum(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compress image with specific options
 */
async function compressImage(options, id) {
  // Implementation for standalone image compression
  self.postMessage({
    type: 'IMAGE_COMPRESSED',
    id,
    result: 'Compressed'
  });
}

/**
 * Extract text from image (OCR)
 */
async function extractText(options, id) {
  // Implementation for OCR
  // This would require Tesseract.js or similar library

  self.postMessage({
    type: 'TEXT_EXTRACTED',
    id,
    result: {
      text: 'Sample extracted text',
      confidence: 0.95
    }
  });
}

/**
 * Validate data structure
 */
async function validateData(options, id) {
  const { data, schema } = options;
  const errors = [];

  // Basic validation logic
  for (const [key, rules] of Object.entries(schema)) {
    const value = data[key];

    if (rules.required && (value === undefined || value === null)) {
      errors.push(`${key} is required`);
    }

    if (rules.type && typeof value !== rules.type) {
      errors.push(`${key} must be of type ${rules.type}`);
    }
  }

  self.postMessage({
    type: 'DATA_VALIDATED',
    id,
    result: {
      valid: errors.length === 0,
      errors
    }
  });
}