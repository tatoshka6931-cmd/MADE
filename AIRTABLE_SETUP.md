# Airtable setup

This describes the base schema, the one form students fill out, and the
automation that stitches a submission together into Student → Project →
Photo links.

## Why this is a little involved

Airtable's native forms can only **link to a record that already exists**
— they cannot create a new Student or Project record and link it in the
same step. So the form collects plain text (name, email, project name)
and an automation resolves that into proper links right after submission.
This is a known Airtable limitation, not something specific to this
project — the "find or create, then link" pattern below is the standard
workaround.

## 1. Tables

**Students**
| Field | Type |
|---|---|
| Name | Single line text |
| Email | Email |
| Projects | Linked record → Projects (auto-created as the reciprocal of the field below) |

**Projects**
| Field | Type |
|---|---|
| Project Name | Single line text (make this the **primary field**) |
| Status | Single select (optional — e.g. In Progress / Done) |
| Student | Linked record → Students |
| Photos | Linked record → Photos (auto-created as the reciprocal of the field below) |

**Photos** — *this is the table the form submits into*
| Field | Type | On the form? |
|---|---|---|
| Student Name | Single line text | Yes |
| Student Email | Email | Yes |
| Submission Type | Single select: `New project` / `Existing project` | Yes |
| New Project Name | Single line text | Yes — shown only when Submission Type = New project |
| Existing Project | Linked record → Projects | Yes — shown only when Submission Type = Existing project |
| Photo | Attachment (allow multiple) | Yes |
| Caption | Long text | Optional — let students add their own since AI captioning isn't in this flow |
| Project | Linked record → Projects | **No** — hidden, filled in by the automation |
| Uploaded At | Created time | No — automatic |

## 2. Build the form on the Photos table

In Airtable, open the Photos table → Form view, and add the fields
marked "Yes" above in that order.

Use **field conditional logic** (the "Show fields based on other
fields" option in the form editor, per field) so:
- `New Project Name` only appears when Submission Type = New project
- `Existing Project` only appears when Submission Type = Existing project

The `Existing Project` field will render as a search box: students type
a few letters and Airtable filters down to matching Project records by
Project Name. That's the "dropdown" behavior you're after — it searches
existing records, it just can't create new ones, which is what the
Submission Type toggle works around.

Two things worth knowing about that search box:
- It searches **every** project in the table — there's no way to scope
  it to just that student's own projects from a public form. In a
  classroom setting where projects are already visible to everyone,
  that's usually fine, but worth knowing if project names should stay
  private between students.
- It matches on whatever the primary field is, which is why
  `Project Name` needs to be set as the Projects table's primary field.

## 3. The automation (find-or-create, then link)

Automations → Create automation → Trigger: **When a record is
created**, table = Photos.

Add one action: **Run a script**. This does the find-or-create logic
that no-code steps handle clumsily. Set these input variables on the
script step (map each to the triggering record's field):

- `photoRecordId` → Record ID
- `studentName` → Student Name
- `studentEmail` → Student Email
- `submissionType` → Submission Type
- `newProjectName` → New Project Name
- `existingProjectId` → Existing Project

Script:

```javascript
let config = input.config();
let studentsTable = base.getTable('Students');
let projectsTable = base.getTable('Projects');
let photosTable = base.getTable('Photos');

let email = (config.studentEmail || '').trim().toLowerCase();
let submissionType = (config.submissionType || '').trim().toLowerCase();

if (!email) {
  console.log('No student email on this submission — nothing to link.');
} else {
  // Find or create the student
  let existingStudents = await studentsTable.selectRecordsAsync({ fields: ['Email'] });
  let studentMatch = existingStudents.records.find(
    (r) => (r.getCellValueAsString('Email') || '').trim().toLowerCase() === email
  );
  let studentId = studentMatch
    ? studentMatch.id
    : await studentsTable.createRecordAsync({
        Name: config.studentName || 'Student',
        Email: config.studentEmail,
      });

  // Find or create the project
  let projectId = null;
  if (submissionType === 'new project' && config.newProjectName) {
    projectId = await projectsTable.createRecordAsync({
      'Project Name': config.newProjectName,
      Student: [{ id: studentId }],
    });
  } else {
    // Read the linked record directly from the submitted Photo. This is
    // more reliable than an automation input variable for linked fields.
    let submittedPhoto = await photosTable.selectRecordAsync(config.photoRecordId);
    let linked = submittedPhoto && submittedPhoto.getCellValue('Existing Project');
    projectId = Array.isArray(linked) ? linked[0]?.id : null;
  }

  // Link this photo record to the resolved project
  if (projectId) {
    await photosTable.updateRecordAsync(config.photoRecordId, {
      Project: [{ id: projectId }],
    });
  } else {
    console.log('Could not resolve a project for this submission — check the form logic.');
  }
}
```

Notes:
- This re-queries all Students on every submission to check for a
  matching email. Fine for classroom-scale data (dozens to a few
  hundred students); if that table gets huge, switch to a filtered
  `selectRecordsAsync` or an indexed lookup.
- Email matching is case-insensitive to match `api/student.js`.

## 4. Staff view

For staff to see everything coming in, add a Grid or Interface view on
the Photos (or Projects) table, grouped by Project or Student. No code
needed — this is just an Airtable view, and it'll update live as
submissions come in through the automation.

## 5. Environment variables (for the web app)

Set these wherever you deploy (e.g. Vercel project settings):
- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_ID`

## 6. What's not currently wired up

- `api/upload.js` (with optional AI captioning via Claude) is included
  but **not used** by this flow, since you're going with the native
  Airtable form. It's there if you later want a custom upload page
  instead of the Airtable form — just note it would need its own
  find-or-create logic added, since it currently assumes a project
  token is already known.
- `api/project.js` returns a single project's name + photo count by
  record ID. Not linked into the frontend yet — potentially useful
  later for a single-project "reveal" page, but not needed for the
  portfolio view.
