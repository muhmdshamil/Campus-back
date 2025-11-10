import express from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import { uploadToCloudinary } from '../config/cloudinary.js';

const router = express.Router();

// Configure multer to handle file uploads in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/pdf' || 
      file.mimetype === 'application/msword' || 
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/png'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, Word documents, and images are allowed'), false);
    }
  },
});

// Upload resume to Cloudinary
router.post('/resume', authenticate, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file, 'campus_resumes');
    
    res.json({ 
      success: true, 
      url: result.url,
      publicId: result.public_id
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error uploading file',
      error: error.message 
    });
  }
});

// Upload any file to Cloudinary
router.post('/file', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Determine folder based on file type
    let folder = 'campus_uploads';
    if (req.file.mimetype.startsWith('image/')) {
      folder = 'campus_images';
    } else if (req.file.mimetype.includes('document') || req.file.mimetype.includes('pdf')) {
      folder = 'campus_documents';
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file, folder);
    
    res.json({ 
      success: true, 
      url: result.url,
      publicId: result.public_id,
      format: result.format
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error uploading file',
      error: error.message 
    });
  }
});

export default router;
