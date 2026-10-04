// Sends email through Gmail SMTP with an app password.
// Config (server .env): GMAIL_USER, GMAIL_APP_PASSWORD, optional NOTIFY_TO
// (defaults to GMAIL_USER, i.e. the agent emails the same Gmail account).
const nodemailer = require('nodemailer');

function mailConfig(env = process.env) {
  const user = (env.GMAIL_USER || '').trim();
  const pass = (env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  if (!user || !pass) return null;
  return { user, pass, to: (env.NOTIFY_TO || user).trim() };
}

function createMailer(config = mailConfig()) {
  if (!config) return null;
  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: config.user, pass: config.pass },
  });
  return {
    to: config.to,
    send: ({ subject, html, text }) =>
      transport.sendMail({ from: `UApplyPal <${config.user}>`, to: config.to, subject, html, text }),
  };
}

module.exports = { createMailer, mailConfig };
