'use strict';

const crypto = require('node:crypto');
const nodemailer = require('nodemailer');

function securelyEqual(a, b) {
  const one = Buffer.from(typeof a === 'string' ? a : '', 'utf8');
  const two = Buffer.from(typeof b === 'string' ? b : '', 'utf8');
  return one.length === two.length && crypto.timingSafeEqual(one, two);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Use the test page.' });
  }

  const key = process.env.TEST_SECRET;
  const received = req.headers['x-test-secret'];
  if (!key || key.length < 24 || !securelyEqual(received, key)) {
    return res.status(401).json({ ok: false, message: 'Invalid test secret.' });
  }

  const { GMAIL_ADDRESS, GMAIL_APP_PASSWORD, TEST_RECIPIENT } = process.env;
  if (!GMAIL_ADDRESS || !GMAIL_APP_PASSWORD || !TEST_RECIPIENT) {
    return res.status(500).json({ ok: false, message: 'Missing environment variables on Vercel.' });
  }

  const address = GMAIL_ADDRESS.trim().toLowerCase();
  const recipient = TEST_RECIPIENT.trim().toLowerCase();
  const appPassword = GMAIL_APP_PASSWORD.replace(/\s+/g, '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address) ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient) ||
      !/^[a-z0-9]{16}$/i.test(appPassword)) {
    return res.status(500).json({ ok: false, message: 'Check the Gmail address, App Password, and test recipient settings.' });
  }

  const action = req.body && typeof req.body === 'object' ? req.body.action : undefined;
  if (action !== 'verify' && action !== 'send') {
    return res.status(400).json({ ok: false, message: 'Invalid test action.' });
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: address, pass: appPassword },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 20000,
  });

  try {
    await transporter.verify();
    if (action === 'verify') {
      return res.status(200).json({ ok: true, message: 'Success! Gmail accepted the App Password.' });
    }

    // The recipient is fixed by the server-side environment variable.
    // User input cannot turn this test endpoint into an open mail relay.
    await transporter.sendMail({
      from: address,
      to: recipient,
      subject: 'MailFlow Gmail SMTP test',
      text: 'This is a test email from your isolated MailFlow Gmail SMTP test. No live MailFlow campaigns were changed.'
    });
    return res.status(200).json({ ok: true, message: 'Test email sent. Check your configured test inbox (and Spam).'});
  } catch (err) {
    console.error('Gmail SMTP test failed:', err?.code || 'unexpected-error');
    const message = err?.code === 'EAUTH'
      ? 'Gmail rejected the login. Check 2-Step Verification and the App Password.'
      : ['ECONNECTION', 'ESOCKET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(err?.code)
        ? 'Could not connect to Gmail SMTP. Try again or check Vercel function logs.'
        : 'SMTP test failed. Check your Vercel function logs for the error code.';
    return res.status(502).json({ ok: false, message });
  } finally {
    transporter.close();
  }
};
