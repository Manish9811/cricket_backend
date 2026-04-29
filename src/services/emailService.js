const nodemailer = require('nodemailer');
const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM, CLIENT_URL } = require('../config/env');

const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: EMAIL_PORT === 465,
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
});

const sendTeamInvite = async ({ toEmail, inviterName, teamName, token }) => {
  const link = `${CLIENT_URL}/join-team?token=${token}`;
  await transporter.sendMail({
    from: EMAIL_FROM,
    to: toEmail,
    subject: `${inviterName} invited you to join ${teamName} on Cricket Scorer`,
    html: `
      <h2>You're invited!</h2>
      <p>${inviterName} has invited you to join <strong>${teamName}</strong>.</p>
      <a href="${link}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
        Accept Invitation
      </a>
      <p>This link expires in 7 days.</p>
    `,
  });
};

const sendMatchReminder = async ({ toEmail, playerName, matchTitle, scheduledAt }) => {
  await transporter.sendMail({
    from: EMAIL_FROM,
    to: toEmail,
    subject: `Match Reminder: ${matchTitle}`,
    html: `
      <h2>Hey ${playerName}!</h2>
      <p>Your match <strong>${matchTitle}</strong> is scheduled for
        <strong>${new Date(scheduledAt).toLocaleString()}</strong>.
      </p>
      <p>Don't forget to mark your availability on Cricket Scorer.</p>
    `,
  });
};

module.exports = { sendTeamInvite, sendMatchReminder };
