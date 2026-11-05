import { Router } from 'express';
import multer from 'multer';
import { voiceTranscribe, voiceConsult } from '../controllers/voiceController.js';

const router = Router();

const allowedAudio = (file) => {
  const mime = String(file?.mimetype || '').toLowerCase();
  return mime.startsWith('audio/') || mime === 'video/webm';
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    if (!allowedAudio(file)) {
      const error = new Error('Unsupported audio format.');
      error.status = 415;
      return callback(error);
    }
    return callback(null, true);
  },
});

router.post('/transcribe', upload.single('audio'), voiceTranscribe);
router.post('/consultation', voiceConsult);

export default router;
