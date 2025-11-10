import express from 'express';
import prisma from '../connection/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// GET /api/jobs - public list with filters
router.get('/', async (req, res) => {
  try {
    const { q, location, companyId } = req.query;
    const where = {
      AND: [
        q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {},
        location ? { location: { contains: location, mode: 'insensitive' } } : {},
        companyId ? { companyId: Number(companyId) } : {},
      ],
    };
    const jobs = await prisma.job.findMany({
      where,
      include: { company: { select: { id: true, name: true, userId: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(jobs);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/jobs/:id - public detail
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const job = await prisma.job.findUnique({
      where: { id },
      include: { company: { select: { id: true, name: true, website: true } } },
    });
    if (!job) return res.status(404).json({ message: 'Not found' });
    return res.json(job);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/jobs - company creates job
router.post('/', authenticate, authorize('COMPANY'), async (req, res) => {
  try {
    const userId = req.user.id;
    const company = await prisma.companyProfile.findUnique({ where: { userId } });
    if (!company) return res.status(400).json({ message: 'Company profile missing' });
    const { title, description, location } = req.body;
    if (!title || !description) return res.status(400).json({ message: 'Title and description required' });
    const job = await prisma.job.create({ data: { title, description, location, companyId: company.id } });
    return res.status(201).json(job);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/jobs/:id - company updates own job
router.put('/:id', authenticate, authorize('COMPANY'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user.id;
    const company = await prisma.companyProfile.findUnique({ where: { userId } });
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return res.status(404).json({ message: 'Not found' });
    if (!company || company.id !== job.companyId) return res.status(403).json({ message: 'Forbidden' });
    const { title, description, location } = req.body;
    const updated = await prisma.job.update({ where: { id }, data: { title, description, location } });
    return res.json(updated);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/jobs/:id - company deletes own job
router.delete('/:id', authenticate, authorize('COMPANY'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user.id;
    const company = await prisma.companyProfile.findUnique({ where: { userId } });
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return res.status(404).json({ message: 'Not found' });
    if (!company || company.id !== job.companyId) return res.status(403).json({ message: 'Forbidden' });
    await prisma.application.deleteMany({ where: { jobId: id } });
    await prisma.job.delete({ where: { id } });
    return res.json({ message: 'Deleted' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
