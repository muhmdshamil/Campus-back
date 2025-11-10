import express from 'express';
import prisma from '../connection/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { sendOfferLetter, sendInterviewInvite } from '../utils/mail.js';

const router = express.Router();

// Company: get all applications for company's jobs
router.get('/company/applications', authenticate, authorize('COMPANY'), async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find the company profile for the current user
    const company = await prisma.companyProfile.findUnique({ 
      where: { userId },
      include: { user: true }
    });
    
    if (!company) {
      return res.status(400).json({ message: 'Company profile not found' });
    }
    
    // Get all jobs posted by this company
    const jobs = await prisma.job.findMany({
      where: { companyId: company.id },
      select: { id: true }
    });
    
    const jobIds = jobs.map(job => job.id);
    
    // Get all applications for these jobs
    const applications = await prisma.application.findMany({
      where: { jobId: { in: jobIds } },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: {
              select: {
                companyName: true,
                user: {
                  select: {
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        },
        student: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return res.json(applications);
  } catch (e) {
    console.error('Error fetching company applications:', e);
    return res.status(500).json({ message: 'Failed to fetch applications' });
  }
});


// Student applies to a job
router.post('/jobs/:jobId/apply', authenticate, authorize('STUDENT'), async (req, res) => {
  try {
    const jobId = Number(req.params.jobId);
    const userId = req.user.id;
    const student = await prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) return res.status(400).json({ message: 'Student profile missing' });
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ message: 'Job not found' });

    const existing = await prisma.application.findFirst({ where: { jobId, studentId: student.id } });
    if (existing) return res.status(409).json({ message: 'Already applied' });

    const { phone, resumeUrl } = req.body || {};
    if (phone || resumeUrl) {
      await prisma.studentProfile.update({ where: { id: student.id }, data: { phone: phone ?? undefined, resumeUrl: resumeUrl ?? undefined } });
    }

    const appRec = await prisma.application.create({ data: { jobId, studentId: student.id } });
    return res.status(201).json(appRec);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Student: list my applications
router.get('/me', authenticate, authorize('STUDENT'), async (req, res) => {
  try {
    const userId = req.user.id;
    const student = await prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) return res.status(400).json({ message: 'Student profile missing' });
    const apps = await prisma.application.findMany({
      where: { studentId: student.id },
      include: { job: { include: { company: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(apps);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Company: list applications for my jobs
router.get('/company', authenticate, authorize('COMPANY'), async (req, res) => {
  try {
    const userId = req.user.id;
    const company = await prisma.companyProfile.findUnique({ where: { userId } });
    if (!company) return res.status(400).json({ message: 'Company profile missing' });
    const apps = await prisma.application.findMany({
      where: { job: { companyId: company.id } },
      include: { 
        job: true, 
        student: { 
          include: { 
            user: true 
          } 
        } 
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Include the full URL for the resume
    const appsWithResumeUrl = apps.map(app => ({
      ...app,
      student: {
        ...app.student,
        resumeUrl: app.student.resumeUrl ? `${process.env.API_URL || 'http://localhost:3001'}${app.student.resumeUrl}` : null
      }
    }));
    
    return res.json(appsWithResumeUrl);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Company: update application status (e.g., ACCEPTED/REJECTED)
router.patch('/:id', authenticate, authorize('COMPANY'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, message } = req.body;
    const userId = req.user.id;
    
    // Get company and application details
    const company = await prisma.companyProfile.findUnique({ 
      where: { userId },
      include: { user: true }
    });
    
    const appRec = await prisma.application.findUnique({ 
      where: { id },
      include: { 
        job: true,
        student: {
          include: {
            user: true
          }
        }
      } 
    });
    
    if (!appRec) return res.status(404).json({ message: 'Application not found' });
    if (!company || appRec.job.companyId !== company.id) {
      return res.status(403).json({ message: 'Not authorized to update this application' });
    }
    
    // Update application status
    const updated = await prisma.application.update({ 
      where: { id }, 
      data: { 
        status: status || appRec.status
      },
      include: {
        job: true,
        student: {
          include: {
            user: true
          }
        }
      }
    });
    
    // Send email notifications based on status
    try {
      const to = updated.student.user.email;
      const studentName = updated.student.user.name;
      const companyName = company.companyName || company.user.name;
      const jobTitle = updated.job.title;

      if (status === 'ACCEPTED') {
        await sendOfferLetter(to, studentName, companyName, jobTitle);
      } else if (status === 'INTERVIEW') {
        await sendInterviewInvite(to, studentName, companyName, jobTitle, message || '');
      }
    } catch (emailError) {
      console.error('Failed to send status email:', emailError);
      // Do not fail the request if email fails
    }
    
    return res.json(updated);
  } catch (e) {
    console.error('Error updating application status:', e);
    return res.status(500).json({ message: 'Failed to update application status' });
  }
});

export default router;
