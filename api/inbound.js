export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing RESEND_API_KEY' });
  }

  try {
    const event = req.body;

    if (event.type !== 'email.received') {
      // Not an inbound email event -- acknowledge and ignore.
      return res.status(200).json({ ignored: true });
    }

    const emailId = event.data.email_id;

    // Webhook payload only has metadata -- fetch the full message.
    const fullEmailResp = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });
    const fullEmail = await fullEmailResp.json();

    const fromAddress = fullEmail.from || event.data.from || 'unknown sender';
    const subject = fullEmail.subject || event.data.subject || '(no subject)';
    const textBody = fullEmail.text || '(no text content -- check original message)';
    const htmlBody = fullEmail.html || `<pre>${textBody}</pre>`;

    // Forward into Gmail, with reply-to set to the original sender.
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Mina Jaan Inbox <contact@minajaan.com>',
        to: ['mimidudhacazan@gmail.com'],
        reply_to: fromAddress,
        subject: `[minajaan.com] ${subject}`,
        html: `<p><strong>From:</strong> ${fromAddress}</p><hr/>${htmlBody}`,
      }),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
