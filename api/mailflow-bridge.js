// Test-only bridge. Keeps the existing /api/test-smtp endpoint unchanged.
// Sends ONLY to the authenticated Gmail address, never to arbitrary recipients.
'use strict';

const crypto = require('node:crypto');
const nodemailer = require('nodemailer');

const MAX_SKEW_SECONDS = 45;

function constantTimeHexEqual(provided, expected) {
  if (typeof provided !== 'string' || !/^[0-9a-f]{64}$/i.test(provided)) return false;
  const a = Buffer.from(provided, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
  }

  const secret = process.env.MAILFLOW_BRIDGE_SECRET;
  if (typeof secret !== 'string' || secret.length < 32) {
    return res.status(503).json({ ok: false, code: 'BRIDGE_NOT_CONFIGURED' });
  }

  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const { action, email, appPassword } = body;
  const timestamp = req.headers['x-mailflow-timestamp'];
  const signature = req.headers['x-mailflow-signature'];

  if (typeof timestamp !== 'string' || !/^\d{10,11}$/.test(timestamp) ||
      Math.abs(Date.now() / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS) {
    return res.status(401).json({ ok: false, code: 'INVALID_SIGNATURE' });
  }
  if (!['verify', 'send-test'].includes(action) ||
      !validEmail(email) || email !== email.toLowerCase().trim() ||
      typeof appPassword !== 'string' || !/^[a-z0-9]{16}$/i.test(appPassword)) {
    return res.status(400).json({ ok: false, code: 'INVALID_INPUT' });
  }

  const signed = [timestamp, action, email, appPassword].join('\n');
  const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  if (!constantTimeHexEqual(signature, expected)) {
    return res.status(401).json({ ok: false, code: 'INVALID_SIGNATURE' });
  }

  // Limit the pilot to the ONE Gmail address already tested on this Vercel deployment.
  const allowedEmail = (process.env.GMAIL_ADDRESS || '').trim().toLowerCase();
  if (!validEmail(allowedEmail) || email !== allowedEmail) {
    return res.status(403).json({ ok: false, code: 'TEST_ACCOUNT_ONLY' });
  }

  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: email, pass: appPassword },
    tls: { minVersion: 'TLSv1.2' },
    connectionTimeout: 12000, greetingTimeout: 12000, socketTimeout: 20000,
  });
  try {
    await transport.verify();
    if (action === 'verify') return res.status(200).json({ ok: true, verified: true });

    const info = await transport.sendMail({
      from: email,
      to: email, // Intentional: account inbox only; no recipient input or campaign content.
      subject: 'MailFlow App Password bridge test',
      text: 'Your MailFlow account successfully sent a test email using the Vercel Gmail SMTP bridge.',
    });
    return res.status(200).json({ ok: true, sent: true, messageId: info.messageId });
  } catch (err) {
    console.error('SMTP bridge failed:', err?.code || 'unknown'); // Do not log passwords or message bodies.
    const code = err?.code === 'EAUTH' ? 'EAUTH' : 'SMTP_UNAVAILABLE';
    return res.status(502).json({ ok: false, code });
  } finally {
    transport.close();
  }
};
