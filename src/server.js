import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import jobsRoutes from './routes/jobs.js';
import applicationsRoutes from './routes/applications.js';
import adminRoutes from './routes/admin.js';
import uploadRoutes from './routes/upload.js';
import studentRoutes from './routes/student.js';
import path from 'path';
import { connectDB } from './connection/prisma.js';

dotenv.config();

const app = express();

// ✅ Allowed origins (production, preview, local)
const allowedOrigins = [
  "http://localhost:5173",
  "https://campusrec-io.vercel.app",
  /\.vercel\.app$/ // ✅ allows ALL Vercel preview URLs
];

// ✅ CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // ✅ allow Postman & mobile apps

    const isAllowed = allowedOrigins.some((o) =>
      o instanceof RegExp ? o.test(origin) : o === origin
    );

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log("🚫 CORS BLOCKED:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // ✅ Preflight CORS support

app.use(express.json());

// ✅ Connect to database
connectDB();

// ✅ Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ✅ API routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/student', studentRoutes);

// ✅ Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ✅ Request logging
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[REQ] ${req.method} ${req.url}`);

  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[RES] ${req.method} ${req.url} -> ${res.statusCode} ${ms}ms`);
  });

  next();
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
