import express from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../connection/prisma.js';
import { signToken } from '../utils/jwt.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, companyName } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Missing fields' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: 'Email already in use' });

    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hash,
        role,
        student: role === 'STUDENT' ? { create: {} } : undefined,
        company: role === 'COMPANY' ? { create: { name: companyName ?? name } } : undefined,
      },
    });

    const token = signToken({ id: user.id, role: user.role, name: user.name });
    return res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    const token = signToken({ id: user.id, role: user.role, name: user.name });
    return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get current authenticated user
router.get('/me', authenticate, async (req, res) => {
  try {
    const u = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!u) return res.status(404).json({ message: 'User not found' });
    return res.json({ id: u.id, name: u.name, email: u.email, role: u.role });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});


// All-in-one account update for Admin/User/Company
// - Self updates: can change name/email/password; password change requires currentPassword
// - Admin can target another user via targetUserId without providing currentPassword
router.put('/update', authenticate, async (req, res) => {
  try {
    const { targetUserId, name, email: newEmail, currentPassword, newPassword } = req.body;

    const isAdmin = req.user.role === 'ADMIN';
    const targetId = targetUserId && isAdmin ? targetUserId : req.user.id;

    const user = await prisma.user.findUnique({ where: { id: targetId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const data = {};

    // Name update (any role, self or admin targeting)
    if (typeof name === 'string' && name.trim() && name.trim() !== user.name) {
      data.name = name.trim();
    }

    // Email update (self or admin targeting) with uniqueness check
    if (typeof newEmail === 'string' && newEmail.trim() && newEmail.trim() !== user.email) {
      const exists = await prisma.user.findUnique({ where: { email: newEmail.trim() } });
      if (exists) return res.status(409).json({ message: 'Email already in use' });
      data.email = newEmail.trim();
    }

    // Password update
    if (typeof newPassword === 'string' && newPassword.length) {
      const isSelf = targetId === req.user.id;
      if (!isAdmin || isSelf) {
        if (!currentPassword) return res.status(400).json({ message: 'Current password is required' });
        const ok = await bcrypt.compare(currentPassword, user.password);
        if (!ok) return res.status(401).json({ message: 'Current password is incorrect' });
      }
      if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });
      const hash = await bcrypt.hash(newPassword, 10);
      data.password = hash;
    }

    if (!Object.keys(data).length) {
      return res.status(400).json({ message: 'No changes provided' });
    }

    const updated = await prisma.user.update({ where: { id: targetId }, data });
    return res.status(200).json({
      message: 'User updated successfully',
      user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
