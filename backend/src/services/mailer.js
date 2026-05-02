// Centralised mail sender.
// - Uses real SMTP credentials when configured via .env (SMTP_HOST, SMTP_PORT, ...)
// - Falls back to Ethereal (a free dev SMTP) so emails are deliverable & previewable
// - Falls back to console logging only when both above are unreachable.
//
// We intentionally never throw on send failures — auth/booking flows must not
// break if mail delivery is degraded.

const nodemailer = require('nodemailer');

let transporterPromise = null;
let transportInfo = '';

function buildSmtpTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    } : undefined,
  });
}

function consoleTransport() {
  return {
    sendMail: async (opts) => {
      console.log('========== [mailer:console] ==========');
      console.log('To:     ', opts.to);
      console.log('Subject:', opts.subject);
      console.log('Text:   ', opts.text || '(html only)');
      console.log('======================================');
      return { messageId: 'console-' + Date.now() };
    },
  };
}

async function getTransporter() {
  if (transporterPromise) return transporterPromise;

  if (process.env.SMTP_HOST) {
    transportInfo = `SMTP ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}`;
    transporterPromise = Promise.resolve(buildSmtpTransport());
    return transporterPromise;
  }

  // Try Ethereal (creates an ephemeral test inbox; viewable via console-printed URL)
  transporterPromise = nodemailer.createTestAccount()
    .then((account) => {
      transportInfo = `Ethereal (${account.user})`;
      console.log(`[mailer] Using Ethereal test inbox: ${account.user}`);
      console.log(`[mailer] Open https://ethereal.email/login with the password printed below to inspect outgoing mail.`);
      console.log(`[mailer] Ethereal pass: ${account.pass}`);
      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: account.user, pass: account.pass },
      });
    })
    .catch((e) => {
      transportInfo = `console-only (Ethereal unavailable: ${e.message})`;
      console.warn(`[mailer] ${transportInfo}`);
      return consoleTransport();
    });
  return transporterPromise;
}

async function sendMail({ to, subject, html, text }) {
  if (!to) return null;
  try {
    const t = await getTransporter();
    const info = await t.sendMail({
      from: process.env.MAIL_FROM || 'Appointly <noreply@appointly.local>',
      to, subject, html, text,
    });
    if (info && info.messageId) {
      const preview = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null;
      console.log(`[mailer] sent → ${to} via ${transportInfo} :: ${subject}` +
        (preview ? `  preview=${preview}` : ''));
    }
    return info;
  } catch (e) {
    console.error('[mailer] send failed:', e.message);
    return null;
  }
}

module.exports = { sendMail };
