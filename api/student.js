// GET /api/student?email=someone@school.edu
//
// Looks a student up by their Email field in the Students table, then
// returns their name plus every project and photo linked to them.
//
// Why email instead of a secret token: students submit through native
// Airtable forms now, so there's no app-generated link to hand back to
// them. Email is something they already know and can type on their own.
// This is NOT strong authentication — anyone who knows (or guesses) a
// student's school email can view their portfolio. That's an acceptable
// trade-off for a low-stakes internal showcase tool, but don't reuse this
// pattern for anything sensitive. See AIRTABLE_SETUP.md for schema notes.

const AIRTABLE_API = 'https://api.airtable.com/v0';

async function airtableGet(path) {
  const res = await fetch(`${AIRTABLE_API}/${process.env.AIRTABLE_BASE_ID}/${path}`, {
    headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// Escapes a value for safe use inside an Airtable filterByFormula string.
function escapeForFormula(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

module.exports = async (req, res) => {
  const email = (req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Missing email' });

  try {
    // 1. Find the student record whose Email field matches (case-insensitive).
    const formula = `LOWER({Email})="${escapeForFormula(email)}"`;
    const searchPath = `Students?maxRecords=1&filterByFormula=${encodeURIComponent(formula)}`;
    const searchResult = await airtableGet(searchPath);

    if (!searchResult.records || searchResult.records.length === 0) {
      return res.status(404).json({
        error: "We couldn't find any submissions for that email. Double-check you typed it exactly as you did on the form.",
      });
    }
    const student = searchResult.records[0];
    const projectIds = student.fields['Projects'] || [];

    // 2. Fetch every linked project in parallel.
    const projects = await Promise.all(
      projectIds.map((id) => airtableGet(`Projects/${id}`))
    );

    // 3. For each project, fetch its linked photos in parallel.
    const projectsWithPhotos = await Promise.all(
      projects.map(async (project) => {
        const photoIds = project.fields['Photos'] || [];
        const photoRecords = await Promise.all(
          photoIds.map((id) => airtableGet(`Photos/${id}`))
        );

        // Each Photos record can hold more than one attachment (the
        // Airtable form's attachment field allows multi-select), so
        // flatten every attachment into its own photo entry.
        const flatPhotos = photoRecords.flatMap((record) => {
          const attachments = record.fields['Photo'] || [];
          return attachments.map((attachment, i) => ({
            id: `${record.id}-${i}`,
            // iPhones often upload HEIC files, which browsers do not reliably
            // render. Airtable's generated thumbnail is a browser-safe image.
            url: attachment.thumbnails?.full?.url || attachment.thumbnails?.large?.url || attachment.url,
            contentType: attachment.type || 'image/jpeg',
            caption: record.fields['Caption'] || '',
            uploadedAt: record.fields['Uploaded At'] || record.createdTime,
          }));
        });

        const sortedPhotos = flatPhotos
          .filter((p) => p.url)
          .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

        return {
          id: project.id,
          name: project.fields['Project Name'] || 'Untitled project',
          status: project.fields['Status'] || '',
          photos: sortedPhotos,
        };
      })
    );

    // Newest projects first (by most recent photo, falling back to name).
    projectsWithPhotos.sort((a, b) => {
      const aDate = a.photos[0]?.uploadedAt || '';
      const bDate = b.photos[0]?.uploadedAt || '';
      return new Date(bDate) - new Date(aDate);
    });

    res.status(200).json({
      name: student.fields['Name'] || 'Student',
      projects: projectsWithPhotos,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong loading that portfolio. Please try again.' });
  }
};
