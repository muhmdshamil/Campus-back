import express from 'express';
import multer from 'multer';
import prisma from '../connection/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { uploadToCloudinary } from '../config/cloudinary.js';

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET current student's profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { student: { include: { applications: true } } },
    });
    if (!user || user.role !== 'STUDENT') return res.status(404).json({ message: 'Student not found' });

    const s = user.student;
    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: s?.phone || '',
      location: s?.location || '',
      education: s?.education || '',
      skills: s?.skills || [],
      bio: s?.bio || '',
      linkedin: s?.linkedin || '',
      github: s?.github || '',
      website: s?.website || '',
      experience: s?.experience || '',
      profileImageUrl: s?.profileImageUrl || '',
      resumeUrl: s?.resumeUrl || '',
      stats: {
        applications: s?.applications?.length || 0,
        interviews: 0,
        offers: 0,
      },
    };
    return res.json(payload);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// UPDATE current student's profile (multipart form)
router.put('/profile', authenticate, upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'resume', maxCount: 1 },
]), async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'STUDENT') return res.status(404).json({ message: 'Student not found' });

    const {
      name,
      phone,
      location,
      education,
      skills,
      bio,
      linkedin,
      github,
      website,
      experience,
    } = req.body;

    // Prepare uploads
    let profileImageUrl;
    if (req.files?.profileImage?.[0]) {
      const uploaded = await uploadToCloudinary(req.files.profileImage[0], 'campus_profile_images');
      profileImageUrl = uploaded.url;
    }
    let resumeUrl;
    if (req.files?.resume?.[0]) {
      const uploaded = await uploadToCloudinary(req.files.resume[0], 'campus_resumes');
      resumeUrl = uploaded.url;
    }

    // Ensure student profile exists
    const existingStudent = await prisma.studentProfile.findUnique({ where: { userId } });
    const skillsArray = typeof skills === 'string' && skills.length
      ? skills.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;

    // Update user basic fields
    const userUpdate = name ? { name } : {};
    if (Object.keys(userUpdate).length) {
      await prisma.user.update({ where: { id: userId }, data: userUpdate });
    }

    const studentData = {
      phone: phone ?? undefined,
      location: location ?? undefined,
      education: education ?? undefined,
      bio: bio ?? undefined,
      linkedin: linkedin ?? undefined,
      github: github ?? undefined,
      website: website ?? undefined,
      experience: experience ?? undefined,
      ...(skillsArray ? { skills: skillsArray } : {}),
      ...(profileImageUrl ? { profileImageUrl } : {}),
      ...(resumeUrl ? { resumeUrl } : {}),
    };

    if (existingStudent) {
      await prisma.studentProfile.update({ where: { userId }, data: studentData });
    } else {
      await prisma.studentProfile.create({ data: { userId, ...studentData } });
    }

    return res.json({ message: 'Profile updated' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
