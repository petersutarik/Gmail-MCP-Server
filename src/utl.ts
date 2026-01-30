import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

/**
 * Helper function to encode email headers containing non-ASCII characters
 * according to RFC 2047 MIME specification
 */
function encodeEmailHeader(text: string): string {
  if (/[^\x00-\x7F]/.test(text)) {
    return '=?UTF-8?B?' + Buffer.from(text).toString('base64') + '?=';
  }
  return text;
}

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export function createEmailMessage(validatedArgs: any): string {
  const encodedSubject = encodeEmailHeader(validatedArgs.subject);

  let mimeType = validatedArgs.mimeType || 'text/plain';
  if (validatedArgs.htmlBody && mimeType !== 'text/plain') {
    mimeType = 'multipart/alternative';
  }

  const boundary = `----=_NextPart_${Math.random().toString(36).substring(2)}`;

  validatedArgs.to.forEach((email: string) => {
    if (!validateEmail(email)) {
      throw new Error(`Recipient email address is invalid: ${email}`);
    }
  });

  const emailParts = [
    'From: me',
    `To: ${validatedArgs.to.join(', ')}`,
    validatedArgs.cc ? `Cc: ${validatedArgs.cc.join(', ')}` : '',
    validatedArgs.bcc ? `Bcc: ${validatedArgs.bcc.join(', ')}` : '',
    `Subject: ${encodedSubject}`,
    validatedArgs.inReplyTo ? `In-Reply-To: ${validatedArgs.inReplyTo}` : '',
    validatedArgs.inReplyTo ? `References: ${validatedArgs.inReplyTo}` : '',
    'MIME-Version: 1.0',
  ].filter(Boolean);

  if (mimeType === 'multipart/alternative') {
    emailParts.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    emailParts.push('');
    emailParts.push(`--${boundary}`);
    emailParts.push('Content-Type: text/plain; charset=UTF-8');
    emailParts.push('Content-Transfer-Encoding: 7bit');
    emailParts.push('');
    emailParts.push(validatedArgs.body);
    emailParts.push('');
    emailParts.push(`--${boundary}`);
    emailParts.push('Content-Type: text/html; charset=UTF-8');
    emailParts.push('Content-Transfer-Encoding: 7bit');
    emailParts.push('');
    emailParts.push(validatedArgs.htmlBody || validatedArgs.body);
    emailParts.push('');
    emailParts.push(`--${boundary}--`);
  } else if (mimeType === 'text/html') {
    emailParts.push('Content-Type: text/html; charset=UTF-8');
    emailParts.push('Content-Transfer-Encoding: 7bit');
    emailParts.push('');
    emailParts.push(validatedArgs.htmlBody || validatedArgs.body);
  } else {
    emailParts.push('Content-Type: text/plain; charset=UTF-8');
    emailParts.push('Content-Transfer-Encoding: 7bit');
    emailParts.push('');
    emailParts.push(validatedArgs.body);
  }

  return emailParts.join('\r\n');
}

export async function createEmailWithNodemailer(validatedArgs: any): Promise<string> {
  validatedArgs.to.forEach((email: string) => {
    if (!validateEmail(email)) {
      throw new Error(`Recipient email address is invalid: ${email}`);
    }
  });

  const transporter = nodemailer.createTransport({
    streamTransport: true,
    newline: 'unix',
    buffer: true
  });

  const attachments: any[] = [];
  for (const filePath of validatedArgs.attachments) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    const fileName = path.basename(filePath);
    attachments.push({
      filename: fileName,
      path: filePath
    });
  }

  const mailOptions = {
    from: 'me',
    to: validatedArgs.to.join(', '),
    cc: validatedArgs.cc?.join(', '),
    bcc: validatedArgs.bcc?.join(', '),
    subject: validatedArgs.subject,
    text: validatedArgs.body,
    html: validatedArgs.htmlBody,
    attachments: attachments,
    inReplyTo: validatedArgs.inReplyTo,
    references: validatedArgs.inReplyTo
  };

  const info = await transporter.sendMail(mailOptions);
  const rawMessage = info.message.toString();
  return rawMessage;
}
