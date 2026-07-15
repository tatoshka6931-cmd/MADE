// POST /api/upload
// Body: { projectToken, imageBase64, filename, contentType }
//
// 1. Creates a new Photos record linked to the project.
// 2. Uploads the image bytes straight into that record's Photo field
//    using Airtable's direct attachment-upload endpoint (no external
//    image host needed).
// 3. If ANTHROPIC_API_KEY is set, asks Claude to draft a caption.
//    This step never blocks or fails the upload itself.

const AIRTABLE_API = 'https://api.airtable.com/v0';
const AIRTABLE_CONTENT_API = 'https://content.airtable.com/v0';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { projectToken, imageBase64, filename, contentType } = req.body || {};
  if (!projectToken || !imageBase64) {
    return res.status(400).json({ error: 'Missing projectToken or imageBase64' });
  }

  const baseId = process.env.AIRTABLE_BASE_ID;
  const jsonHeaders = {
    Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    // 1. Create the Photos record (attachment field starts empty).
    const createRes = await fetch(`${AIRTABLE_API}/${baseId}/Photos`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ fields: { Project: [projectToken] } }),
    });
    if (!createRes.ok) throw new Error(await createRes.text());
    const record = await createRes.json();

    // 2. Upload the image bytes directly to that record's Photo field.
    const uploadRes = await fetch(
      `${AIRTABLE_CONTENT_API}/${baseId}/${record.id}/Photo`,
      {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          contentType: contentType || 'image/jpeg',
          file: imageBase64,
          filename: filename || 'photo.jpg',
        }),
      }
    );
    if (!uploadRes.ok) throw new Error(await uploadRes.text());

    // 3. Optional AI caption draft. Wrapped so a failure here never
    //    breaks the upload the student is waiting on.
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const captionRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 60,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: contentType || 'image/jpeg',
                      data: imageBase64,
                    },
                  },
                  {
                    type: 'text',
                    text: 'Write one short, plain, portfolio-appropriate caption for this project photo. No hashtags, no quotes, just the sentence.',
                  },
                ],
              },
            ],
          }),
        });
        const captionData = await captionRes.json();
        const caption = captionData?.content?.[0]?.text?.trim();
        if (caption) {
          await fetch(`${AIRTABLE_API}/${baseId}/Photos/${record.id}`, {
            method: 'PATCH',
            headers: jsonHeaders,
            body: JSON.stringify({
              fields: { Caption: caption, 'Caption Source': 'AI' },
            }),
          });
        }
      } catch (capErr) {
        console.error('Captioning skipped:', capErr);
      }
    }

    // 4. Return the project's fresh photo count for the confirmation screen.
    const projectRes = await fetch(
      `${AIRTABLE_API}/${baseId}/Projects/${projectToken}`,
      { headers: jsonHeaders }
    );
    const project = await projectRes.json();
    const photoCount = (project.fields?.Photos || []).length;

    res.status(200).json({ ok: true, photoCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed. Please try again.' });
  }
};
