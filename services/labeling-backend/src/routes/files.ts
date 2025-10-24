import { Router } from 'express';
import FilesController from '../controllers/filesController';
import { FileManagementConfig } from '../controllers/filesController';

export default function createFilesRoutes(config: FileManagementConfig): Router {
  const router = Router();
  const filesController = new FilesController(config);

  // Single file upload
  router.post('/upload', filesController.getUploadMiddleware().single('file'), filesController.uploadSingle);

  // Multiple files upload
  router.post('/upload/multiple', filesController.getUploadMiddleware().array('files', 10), filesController.uploadMultiple);

  // Multipart upload for large files
  router.post('/upload/multipart/create', filesController.createMultipartUpload);
  router.post('/upload/multipart/complete', filesController.completeMultipartUpload);

  // Presigned URLs
  router.get('/upload/url', filesController.getPresignedUploadUrl);
  router.get('/download/url', filesController.getPresignedDownloadUrl);

  // File operations
  router.get('/info/:key(*)', filesController.getFileInfo);
  router.get('/list', filesController.listFiles);
  router.delete('/:key(*)', filesController.deleteFile);

  // Image processing
  router.post('/process/:key(*)', filesController.processImage);

  // Virus scanner management
  router.get('/scanner/status', filesController.getScannerStatus);
  router.post('/scanner/update-database', filesController.updateVirusDatabase);

  return router;
}