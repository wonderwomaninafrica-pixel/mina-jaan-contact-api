export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, message, subscribe } = req.body || {};

  if (!email || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing RESEND_API_KEY' });
  }

  try {
    // 1. Email the message to Mina
    const emailResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Mina Jaan Website <contact@minajaan.com>',
        to: ['mimidudhacazan@gmail.com'],
        reply_to: email,
        subject: `New contact form message from ${name || email}`,
        html: `<p><strong>Name:</strong> ${name || 'N/A'}</p>
               <p><strong>Email:</strong> ${email}</p>
               <p><strong>Wants release updates:</strong> ${subscribe ? 'Yes' : 'No'}</p>
               <p><strong>Message:</strong></p>
               <p>${String(message).replace(/\n/g, '<br/>')}</p>`,
      }),
    });

    if (!emailResp.ok) {
      const errText = await emailResp.text();
      console.error('Resend email error:', errText);
    }

    // 2. If they opted in, add them to the (auto-discovered) audience
    if (subscribe) {
      const audienceListResp = await fetch('https://api.resend.com/audiences', {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      });
      const audienceData = await audienceListResp.json();
      const audienceId = audienceData?.data?.[0]?.id;

      if (audienceId) {
        await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            first_name: name || undefined,
            unsubscribed: false,
          }),
        });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
