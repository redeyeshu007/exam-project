const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const Admin = require('../models/Admin');
const { protect } = require('../middleware/auth');
const logger = require('../logger');

/* ── Email transporter ─────────────────────────────────────────────────── */
const createTransporter = () => nodemailer.createTransport({
  host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.EMAIL_PORT  || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

const otpEmailHtml = (otp) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    body { margin:0; padding:0; background-color:#F4F7F9; font-family:'Segoe UI','Roboto',Helvetica,Arial,sans-serif; -webkit-font-smoothing:antialiased; }
    .container { max-width:600px; margin:40px auto; background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08); border:1px solid #E1E8ED; }
    .header { background-color:#B42B6A; padding:32px; text-align:center; color:#ffffff; }
    .header h1 { margin:0; font-size:20px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; }
    .header p { margin:8px 0 0; font-size:13px; opacity:0.9; font-weight:400; }
    .content { padding:40px 48px; color:#333333; line-height:1.6; }
    .greeting { font-size:16px; font-weight:700; color:#1A1A1A; margin-bottom:16px; }
    .instruction { font-size:14px; color:#555555; margin-bottom:32px; }
    .otp-container { background-color:#F8FAFC; border:2px solid #E2E8F0; border-radius:12px; padding:32px; text-align:center; margin-bottom:32px; }
    .otp-label { font-size:12px; font-weight:700; color:#718096; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; }
    .otp-code { font-size:48px; font-weight:800; color:#B42B6A; letter-spacing:10px; font-family:'Monaco','Courier New',monospace; margin:12px 0; -webkit-user-select:all; user-select:all; cursor:text; }
    .otp-expiry { font-size:12px; color:#A0AEC0; }
    .notice-box { background-color:#FFF5F5; border-left:4px solid #FEB2B2; padding:16px 20px; margin-bottom:32px; border-radius:0 4px 4px 0; }
    .notice-text { font-size:12px; color:#C53030; font-weight:500; margin:0; }
    .footer { background-color:#F8FAFC; padding:24px 48px; border-top:1px solid #EDF2F7; text-align:center; font-size:11px; color:#718096; line-height:1.8; }
    .footer strong { color:#B42B6A; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>E-Exam Hall Allocation System</h1>
      <p>PSNA College of Engineering & Technology — Dept. of CSE</p>
    </div>
    <div class="content">
      <div class="greeting">Dear Exam Cell Incharge,</div>
      <p class="instruction">
        We have received a request to verify your identity for a password reset on your administrative account. Please <strong>select and copy</strong> the following One-Time Password (OTP) below.
      </p>
      
      <div class="otp-container">
        <div class="otp-label">One-Time Password</div>
        <div class="otp-code">${otp}</div>
        <div class="otp-expiry">Valid for <strong>5 minutes</strong> &middot; Select code to copy</div>
      </div>

      <div class="notice-box">
        <p class="notice-text">
          <strong>Security Notice:</strong> Do not share this code with anyone. If you did not request this verification, please secure your account immediately.
        </p>
      </div>
    </div>
    <div class="footer">
      &copy; 2026 <strong>CSE Exam Cell</strong> &middot; PSNA College of Engineering &amp; Technology<br/>
      cseexamcell2023@gmail.com &middot; Dindigul, Tamil Nadu
    </div>
  </div>
</body>
</html>`;

const suspiciousActivityEmailHtml = (ip, time, attempts) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    body { margin:0; padding:0; background-color:#F4F7F9; font-family:'Segoe UI','Roboto',Helvetica,Arial,sans-serif; -webkit-font-smoothing:antialiased; }
    .container { max-width:600px; margin:40px auto; background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08); border:1px solid #E1E8ED; }
    .header { background-color:#B91C1C; padding:32px; text-align:center; color:#ffffff; }
    .header h1 { margin:0; font-size:20px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; }
    .header p { margin:8px 0 0; font-size:13px; opacity:0.9; font-weight:400; }
    .content { padding:40px 48px; color:#333333; line-height:1.6; }
    .greeting { font-size:16px; font-weight:700; color:#1A1A1A; margin-bottom:16px; }
    .instruction { font-size:14px; color:#555555; margin-bottom:24px; }
    .detail-table { width:100%; border-collapse:collapse; margin-bottom:24px; }
    .detail-table td { padding:10px 14px; font-size:13px; border-bottom:1px solid #EDF2F7; }
    .detail-table td:first-child { font-weight:700; color:#718096; width:160px; text-transform:uppercase; font-size:11px; letter-spacing:0.5px; }
    .detail-table td:last-child { color:#1A1A1A; font-weight:600; }
    .notice-box { background-color:#FFF5F5; border-left:4px solid #FEB2B2; padding:16px 20px; margin-bottom:8px; border-radius:0 4px 4px 0; }
    .notice-text { font-size:12px; color:#C53030; font-weight:500; margin:0; }
    .footer { background-color:#F8FAFC; padding:24px 48px; border-top:1px solid #EDF2F7; text-align:center; font-size:11px; color:#718096; line-height:1.8; }
    .footer strong { color:#B42B6A; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Suspicious Login Activity Detected</h1>
      <p>PSNA College of Engineering & Technology — Dept. of CSE</p>
    </div>
    <div class="content">
      <div class="greeting">Dear Exam Cell Incharge,</div>
      <p class="instruction">
        We detected <strong>${attempts} consecutive failed login attempts</strong> on your administrative account. As a precaution, the account has been temporarily locked.
      </p>
      <table class="detail-table">
        <tr><td>Failed Attempts</td><td>${attempts}</td></tr>
        <tr><td>IP Address</td><td>${ip}</td></tr>
        <tr><td>Time</td><td>${time}</td></tr>
      </table>
      <div class="notice-box">
        <p class="notice-text">
          <strong>Security Notice:</strong> If this wasn't you, someone may be attempting to guess your password. Consider changing your password once you regain access. If this was you, please wait for the lockout period to end before trying again.
        </p>
      </div>
    </div>
    <div class="footer">
      &copy; 2026 <strong>CSE Exam Cell</strong> &middot; PSNA College of Engineering &amp; Technology<br/>
      cseexamcell2023@gmail.com &middot; Dindigul, Tamil Nadu
    </div>
  </div>
</body>
</html>`;

/* ── Login lockout policy — escalating, cumulative across cycles ────────── */
const LOCKOUT_TIERS = { 5: 5, 10: 10, 15: 15 }; // failedLoginAttempts threshold -> lock minutes
const SUSPICIOUS_ACTIVITY_THRESHOLD = 15;

/* ── POST /api/auth/login ───────────────────────────────────────────────── */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });

    // Account currently locked — reject before touching the password at all.
    if (admin && admin.lockUntil && admin.lockUntil > new Date()) {
      const remainingMs = admin.lockUntil.getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      logger.warn('Login blocked — account locked', { email, ip: req.ip, remainingMin });
      return res.status(423).json({
        message: `Too many failed attempts. Try again in ${remainingMin} minute${remainingMin === 1 ? '' : 's'}.`,
      });
    }

    if (admin && (await bcrypt.compare(password, admin.password))) {
      if (admin.failedLoginAttempts > 0 || admin.lockUntil) {
        admin.failedLoginAttempts = 0;
        admin.lockUntil = null;
        await admin.save();
      }
      const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
      logger.info('Admin login success', { email: admin.email, ip: req.ip });
      return res.json({ _id: admin._id, email: admin.email, name: admin.name, token });
    }

    // Failed attempt — track and apply escalating lockout if this admin exists.
    if (admin) {
      admin.failedLoginAttempts += 1;
      const lockMinutes = LOCKOUT_TIERS[admin.failedLoginAttempts];
      if (lockMinutes) {
        admin.lockUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
      }
      await admin.save();

      if (admin.failedLoginAttempts === SUSPICIOUS_ACTIVITY_THRESHOLD) {
        try {
          const transporter = createTransporter();
          await transporter.sendMail({
            from:    `"E-Exam Hall System 🎓" <${process.env.EMAIL_USER}>`,
            to:      admin.email,
            subject: 'Suspicious Login Activity — PSNA CSE Exam Cell',
            html:    suspiciousActivityEmailHtml(req.ip, new Date().toLocaleString('en-IN'), admin.failedLoginAttempts),
          });
          logger.warn('Suspicious activity email sent', { email: admin.email, ip: req.ip });
        } catch (mailErr) {
          logger.error('Failed to send suspicious activity email', { message: mailErr.message });
        }
      }

      if (lockMinutes) {
        logger.warn('Account locked after repeated failed attempts', { email, ip: req.ip, attempts: admin.failedLoginAttempts, lockMinutes });
        return res.status(423).json({
          message: `Too many failed attempts. Account locked for ${lockMinutes} minute${lockMinutes === 1 ? '' : 's'}.`,
        });
      }
    }

    logger.warn('Admin login failed', { email, ip: req.ip });
    return res.status(401).json({ message: 'Invalid email or password' });
  } catch (error) {
    logger.error('Login error', { message: error.message });
    res.status(500).json({ message: 'Server error during login' });
  }
});

/* ── GET /api/auth/verify ──────────────────────────────────────────────── */
router.get('/verify', protect, (req, res) => {
  res.json({ message: 'Token is valid' });
});

/* ── GET /api/auth/me ──────────────────────────────────────────────────── */
router.get('/me', protect, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id).select('-password -otpCode');
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    res.json(admin);
  } catch (error) {
    logger.error('GET /me error', { message: error.message, stack: error.stack });
    res.status(500).json({ message: 'Server error' });
  }
});

/* ── POST /api/auth/send-otp ───────────────────────────────────────────── */
router.post('/send-otp', async (req, res) => {
  try {
    const admin = await Admin.findOne({});
    if (!admin) return res.status(404).json({ message: 'Admin account not found' });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const hash = await bcrypt.hash(otp, 10);
    admin.otpCode   = hash;
    admin.otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // Updated to 5 minutes
    await admin.save();

    const transporter = createTransporter();
    await transporter.sendMail({
      from:    `"E-Exam Hall System 🎓" <${process.env.EMAIL_USER}>`,
      to:      admin.email,
      subject: 'Password Reset OTP — PSNA CSE Exam Cell',
      html:    otpEmailHtml(otp),
    });

    const masked = admin.email.replace(/(.{3}).*?(@.*)/, '$1***$2');
    logger.info('OTP sent', { email: masked, ip: req.ip });
    res.json({ message: 'OTP sent', emailMasked: masked });
  } catch (error) {
    logger.error('send-otp error', { message: error.message });
    res.status(500).json({ message: 'Failed to send OTP. Check server email configuration.' });
  }
});

/* ── POST /api/auth/verify-otp ─────────────────────────────────────────── */
router.post('/verify-otp', async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ message: 'OTP is required' });
    const admin = await Admin.findOne({});
    if (!admin?.otpCode || !admin?.otpExpiry)
      return res.status(400).json({ message: 'No OTP was requested. Send OTP first.' });
    if (new Date() > admin.otpExpiry)
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    const match = await bcrypt.compare(String(otp), admin.otpCode);
    if (!match) return res.status(400).json({ message: 'Incorrect OTP. Please try again.' });
    res.json({ message: 'OTP verified', valid: true });
  } catch (error) {
    logger.error('verify-otp error', { message: error.message });
    res.status(500).json({ message: 'Server error' });
  }
});

/* ── POST /api/auth/reset-password ─────────────────────────────────────── */
router.post('/reset-password', async (req, res) => {
  try {
    const { otp, newPassword } = req.body;
    if (!otp || !newPassword)
      return res.status(400).json({ message: 'OTP and new password are required' });
    if (newPassword.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const admin = await Admin.findOne({});
    if (!admin?.otpCode || !admin?.otpExpiry)
      return res.status(400).json({ message: 'No OTP was requested' });
    if (new Date() > admin.otpExpiry)
      return res.status(400).json({ message: 'OTP has expired' });
    const match = await bcrypt.compare(String(otp), admin.otpCode);
    if (!match) return res.status(400).json({ message: 'Incorrect OTP' });

    admin.password  = await bcrypt.hash(newPassword, 10);
    admin.otpCode   = undefined;
    admin.otpExpiry = undefined;
    await admin.save();

    logger.info('Password reset successfully', { ip: req.ip });
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    logger.error('reset-password error', { message: error.message });
    res.status(500).json({ message: 'Server error' });
  }
});

/* ── PATCH /api/auth/change-password (protected — logged in) ───────────── */
router.patch('/change-password', protect, async (req, res) => {
  try {
    const { otp, newPassword } = req.body;
    if (!otp || !newPassword)
      return res.status(400).json({ message: 'OTP and new password are required' });
    if (newPassword.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const admin = await Admin.findById(req.user.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (!admin.otpCode || !admin.otpExpiry)
      return res.status(400).json({ message: 'No OTP was requested' });
    if (new Date() > admin.otpExpiry)
      return res.status(400).json({ message: 'OTP has expired' });
    const match = await bcrypt.compare(String(otp), admin.otpCode);
    if (!match) return res.status(400).json({ message: 'Incorrect OTP' });

    admin.password  = await bcrypt.hash(newPassword, 10);
    admin.otpCode   = undefined;
    admin.otpExpiry = undefined;
    await admin.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('change-password error', { message: error.message, stack: error.stack });
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
