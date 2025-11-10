import nodemailer from 'nodemailer';




let transporter;

export function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }
  return transporter;
}

export async function sendEmail({ to, subject, html, text }) {
  const tx = getTransporter();
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@campus.local';
  const info = await tx.sendMail({ from, to, subject, html, text });
  return info;
}

export async function sendOfferLetter(toEmail, studentName, companyName, jobTitle) {
  const subject = `Congratulations! ${companyName} accepted your application`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Congratulations, ${studentName}!</h2>
      <p>Your application for the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong> has been <strong>ACCEPTED</strong>.</p>
      <p>We are excited to move forward. Our team will reach out with next steps shortly.</p>
      <h3 style="margin-top:16px;">Next Steps</h3>
      <ol>
        <li>Please reply to confirm your acceptance.</li>
        <li>Share your availability for onboarding discussions.</li>
        <li>Prepare required documents (ID, transcripts, etc.).</li>
      </ol>
      <p style="color:#6b7280; font-size:12px; margin-top:16px;">Sent on: ${new Date().toLocaleString()}</p>
      <p>Best regards,<br/>${companyName} Team</p>
    </div>
  `;
  const text = `Congratulations, ${studentName}! Your application for ${jobTitle} at ${companyName} has been ACCEPTED.\n\nNext steps:\n1) Reply to confirm acceptance\n2) Share availability for onboarding discussion\n3) Prepare required documents\n\nSent on: ${new Date().toLocaleString()}`;
  return sendEmail({ to: toEmail, subject, html, text });
}

export async function sendInterviewInvite(toEmail, studentName, companyName, jobTitle, note) {
  const subject = `Interview Invitation: ${jobTitle} at ${companyName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Interview Invitation</h2>
      <p>Hi ${studentName},</p>
      <p>${companyName} would like to invite you to interview for the <strong>${jobTitle}</strong> role.</p>
      ${note ? `<p><strong>Details / Note from company:</strong><br/>${escapeHtml(note)}</p>` : ''}
      <div style="margin-top:12px;">
        <h3 style="margin:0 0 6px 0;">Interview Logistics</h3>
        <ul>
          <li><strong>Format:</strong> Online/Onsite (reply with your preference)</li>
          <li><strong>Proposed date/time:</strong> Please reply with 2-3 suitable slots</li>
          <li><strong>Location/Link:</strong> Will be shared upon confirmation</li>
        </ul>
      </div>
      <p>Please reply to this email to coordinate timing.</p>
      <p style="color:#6b7280; font-size:12px;">Sent on: ${new Date().toLocaleString()}</p>
      <p>Best regards,<br/>${companyName} Talent Team</p>
    </div>
  `;
  const text = `Hi ${studentName},\n${companyName} invites you to interview for ${jobTitle}.` +
    `${note ? `\nDetails: ${note}` : ''}` +
    `\n\nInterview logistics:\n- Format: Online/Onsite (confirm preference)\n- Proposed date/time: Please reply with 2-3 slots\n- Location/Link: Will be shared upon confirmation\n\nPlease reply to coordinate timing.\nSent on: ${new Date().toLocaleString()}`;
  return sendEmail({ to: toEmail, subject, html, text });
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
