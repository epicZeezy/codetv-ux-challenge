const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const SUBMISSIONS_PATH = path.join(__dirname, "submissions.json");

// Parse URL-encoded form bodies from the HTML form POST
app.use(express.urlencoded({ extended: true }));

// Serve the static order form from public/
app.use(express.static(path.join(__dirname, "public")));

/** Read submissions from disk; default to [] if missing or invalid */
function readSubmissions() {
  try {
    const raw = fs.readFileSync(SUBMISSIONS_PATH, "utf8").trim();
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    console.error("Failed to read submissions:", err.message);
    return [];
  }
}

/** Persist the submissions array to submissions.json */
function writeSubmissions(submissions) {
  fs.writeFileSync(SUBMISSIONS_PATH, JSON.stringify(submissions, null, 2));
}

/** Escape text for safe inclusion in HTML responses */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// POST /submit-order — append form data and show confirmation page
app.post("/submit-order", (req, res) => {
  const submission = {
    ...req.body,
    id: Date.now(),
    submittedAt: new Date().toISOString(),
  };

  const submissions = readSubmissions();
  submissions.push(submission);
  writeSubmissions(submissions);

  const prettyJson = escapeHtml(JSON.stringify(submission, null, 2));

  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Submitted</title>
  <style>
    :root { --bg: #fbf7ef; --paper: #fffdf8; --accent: #6f3ff5; --border: #d8cbb9; }
    body { font-family: system-ui, sans-serif; background: var(--bg); color: #2a2418; margin: 0; padding: 2rem; }
    .card { max-width: 40rem; margin: 0 auto; background: var(--paper); border: 1px solid var(--border); border-radius: 28px; padding: 2rem; box-shadow: 0 12px 40px rgba(42, 36, 24, 0.08); }
    h1 { color: var(--accent); margin-top: 0; }
    pre { background: #f5efe3; border-radius: 14px; padding: 1rem; overflow-x: auto; font-size: 0.875rem; }
    a { color: var(--accent); }
  </style>
</head>
<body>
  <div class="card">
    <h1>Order submitted</h1>
    <p>Your order was saved successfully. Saved record:</p>
    <pre>${prettyJson}</pre>
    <p><a href="/">Submit another order</a> · <a href="/submissions">View all submissions</a></p>
  </div>
</body>
</html>`);
});

// GET /submissions — list every saved submission
app.get("/submissions", (req, res) => {
  const submissions = readSubmissions();

  const items =
    submissions.length === 0
      ? "<p>No submissions yet.</p>"
      : submissions
          .map((s) => {
            const name = escapeHtml(s.fullName || "(no name)");
            const email = escapeHtml(s.email || "(no email)");
            const time = escapeHtml(s.submittedAt || "(no timestamp)");
            const json = escapeHtml(JSON.stringify(s, null, 2));
            return `
    <article class="submission">
      <h2>${name}</h2>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Submitted:</strong> ${time}</p>
      <pre>${json}</pre>
    </article>`;
          })
          .join("");

  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>All Submissions</title>
  <style>
    :root { --bg: #fbf7ef; --paper: #fffdf8; --accent: #6f3ff5; --border: #d8cbb9; }
    body { font-family: system-ui, sans-serif; background: var(--bg); color: #2a2418; margin: 0; padding: 2rem; }
    .wrap { max-width: 48rem; margin: 0 auto; }
    h1 { color: var(--accent); }
    .submission { background: var(--paper); border: 1px solid var(--border); border-radius: 28px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 8px 24px rgba(42, 36, 24, 0.06); }
    .submission h2 { margin-top: 0; }
    pre { background: #f5efe3; border-radius: 14px; padding: 1rem; overflow-x: auto; font-size: 0.875rem; }
    a { color: var(--accent); }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>All submissions</h1>
    ${items}
    <p><a href="/">Back to order form</a></p>
  </div>
</body>
</html>`);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Order form server running on port ${PORT}`);
});
