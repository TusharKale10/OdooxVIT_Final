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
  const cfg = {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    } : undefined,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  };
  console.log(`[mailer:debug] building transport host=${cfg.host} port=${cfg.port} secure=${cfg.secure} user=${cfg.auth?.user || '(none)'} passLen=${cfg.auth?.pass?.length || 0}`);
  return nodemailer.createTransport(cfg);
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
  console.log(`[mailer:debug] sendMail called to=${to} subject="${subject}"`);
  try {
    console.log('[mailer:debug] awaiting getTransporter()...');
    const t = await getTransporter();
    console.log(`[mailer:debug] transporter ready (${transportInfo}); calling sendMail...`);
    const info = await t.sendMail({
      from: process.env.MAIL_FROM || 'Appointly <noreply@appointly.local>',
      to, subject, html, text,
    });
    if (info && info.messageId) {
      const preview = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null;
      console.log(`[mailer] sent → ${to} via ${transportInfo} :: ${subject}` +
        (preview ? `  preview=${preview}` : ''));
    } else {
      console.log(`[mailer:debug] sendMail returned without messageId; info=${JSON.stringify(info)}`);
    }
    return info;
  } catch (e) {
    console.error('[mailer] send failed:', e.message);
    console.error('[mailer:debug] error code=', e.code, 'command=', e.command, 'response=', e.response);
    return null;
  }
}

module.exports = { sendMail };
