import express from 'express';
import prisma from '../connection/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get admin dashboard statistics
router.get('/stats', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    console.log('Fetching admin stats...');
    
    const [
      totalUsers,
      totalJobs,
      totalApplications,
      approvedApplications
    ] = await Promise.all([
      prisma.user.count().catch(e => {
        console.error('Error counting users:', e);
        return 0;
      }),
      prisma.job.count().catch(e => {
        console.error('Error counting jobs:', e);
        return 0;
      }),
      prisma.application.count().catch(e => {
        console.error('Error counting applications:', e);
        return 0;
      }),
      prisma.application.count({
        where: { status: 'APPROVED' }
      }).catch(e => {
        console.error('Error counting approved applications:', e);
        return 0;
      })
    ]);

    console.log('Stats fetched successfully:', {
      totalUsers,
      totalJobs,
      totalApplications,
      approvedApplications
    });

    res.json({
      totalUsers,
      totalJobs,
      totalApplications,
      approvedApplications
    });
  } catch (error) {
    console.error('Error in /stats endpoint:', error);
    res.status(500).json({ 
      message: 'Failed to fetch admin statistics',
      error: error.message 
    });
  }
});

// Get recent users
router.get('/users', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    console.log('Fetching recent users...');
    const limit = parseInt(req.query.limit) || 5;
    
    const users = await prisma.user.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        student: true,
        company: true
      }
    }).catch(e => {
      console.error('Database error in /users:', e);
      throw e;
    });

    // Format the response
    const formattedUsers = users.map(user => {
      const profile = user.student || user.company || {};
      return {
        id: user.id,
        name: user.name || 'Unknown',
        email: user.email || 'No email',
        role: user.role || 'USER',
        status: 'ACTIVE', // Default status since it's not in the schema
        createdAt: user.createdAt,
        profile: {
          id: profile.id,
          phone: profile.phone || null,
          companyName: profile.name || null
        }
      };
    });

    console.log(`Returning ${formattedUsers.length} users`);
    res.json(formattedUsers);
  } catch (error) {
    console.error('Error in /users endpoint:', error);
    res.status(500).json({ 
      message: 'Failed to fetch users',
      error: error.message 
    });
  }
});

// Get recent jobs
router.get('/jobs', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    console.log('Fetching recent jobs...');
    const limit = parseInt(req.query.limit) || 5;
    
    const jobs = await prisma.job.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        company: {
          include: {
            user: true
          }
        },
        applications: {
          select: {
            id: true
          }
        }
      }
    }).catch(e => {
      console.error('Database error in /jobs:', e);
      throw e;
    });

    // Format the response with null checks
    const formattedJobs = jobs.map(job => {
      const company = job.company || {};
      const companyUser = company.user || {};
      
      return {
        id: job.id,
        title: job.title || 'Untitled Job',
        type: job.type || 'FULL_TIME',
        status: 'ACTIVE', // Default status since it's not in the schema
        createdAt: job.createdAt,
        company: {
          id: company.id || 'unknown',
          name: company.name || companyUser.name || 'Unknown Company',
          email: companyUser.email || 'no-email@example.com'
        },
        applicationCount: job.applications?.length || 0
      };
    });

    console.log(`Returning ${formattedJobs.length} jobs`);
    res.json(formattedJobs);
  } catch (error) {
    console.error('Error in /jobs endpoint:', error);
    res.status(500).json({ 
      message: 'Failed to fetch jobs',
      error: error.message 
    });
  }
});

export default router;
