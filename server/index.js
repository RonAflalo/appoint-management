require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { initializeDatabase } = require('./db/database');
const { verifyEmailConnection } = require('./services/emailService');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const workerRoutes = require('./routes/worker');
const userRoutes = require('./routes/user');
const tenantRoutes = require('./routes/tenant');
const publicRoutes = require('./routes/public');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Initialize DB
initializeDatabase();

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/worker', workerRoutes);
app.use('/api', userRoutes);
app.use('/api/public', publicRoutes);
app.use('/api', tenantRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'שגיאת שרת פנימית' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  verifyEmailConnection();
});
