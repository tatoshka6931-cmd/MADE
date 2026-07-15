// GET /api/project?token=recXXXXXXXXXXXXXX
//
// Returns just enough info to run the upload page for one project: its
// name and current photo count. The token is the Project record ID.

const AIRTABLE_API = 'https://api.airtable.com/v0';

module.exports = async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).json({ error: 'Missing token' });

  try {
    const r = await fetch(
      `${AIRTABLE_API}/${process.env.AIRTABLE_BASE_ID}/Projects/${encodeURIComponent(token)}`,
      { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` } }
    );
    if (!r.ok) throw new Error(await r.text());
    const project = await r.json();

    res.status(200).json({
      name: project.fields['Project Name'] || 'Untitled project',
      photoCount: (project.fields['Photos'] || []).length,
    });
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: 'Link not recognized. Double-check the URL.' });
  }
};