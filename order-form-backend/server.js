const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const SUBMISSIONS_PATH = path.join(__dirname, "submissions.json");
// Parse URL-encoded form bodies from the HTML form POST
app.use(express.urlencoded({ extended: true }));

/** Optional phone: empty is OK; otherwise exactly 10 digits, no other characters */
function isPhoneValid(phone) {
  const value = String(phone || "").trim();
  if (!value) return true;
  return /^\d{10}$/.test(value);
}

/** Escape text for safe inclusion in HTML responses */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const DESIGN_TOKENS_CSS = `
  :root {
    --bg: #fbf7ef;
    --paper: #fffdf8;
    --accent: #6f3ff5;
    --border: #d8cbb9;
    --text: #2a2418;
    --muted: #6b5f4e;
    --success: #067647;
    --success-bg: #ecfdf3;
    --success-border: #abefc6;
  }
`;

/** Mask card number, showing only the last four digits */
function maskCardNumber(cardNumber) {
  const digits = String(cardNumber || "").replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `•••• •••• •••• ${digits.slice(-4)}`;
}

function formatDisplayDate(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatSubmittedAt(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function renderSummaryRow(label, value) {
  if (value === undefined || value === null || value === "") return "";
  return `<div class="summary-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`;
}

function renderSummarySection(title, rowsHtml) {
  if (!rowsHtml.trim()) return "";
  return `<section class="summary-section">
      <h2>${escapeHtml(title)}</h2>
      <dl class="summary-grid">${rowsHtml}</dl>
    </section>`;
}

/** Render submission fields grouped by form section */
function renderSubmissionSummary(submission, { masked = true } = {}) {
  const customerRows = [
    renderSummaryRow("Full name", submission.fullName),
    renderSummaryRow("Email", submission.email),
    submission.phone ? renderSummaryRow("Phone", submission.phone) : "",
  ].join("");

  const shippingRows = [
    renderSummaryRow("Address", submission.shippingAddress),
    renderSummaryRow(
      "Preferred delivery",
      formatDisplayDate(submission.preferredDeliveryDate)
    ),
  ].join("");

  const cardDisplay = masked
    ? maskCardNumber(submission.cardNumber)
    : submission.cardNumber;
  const cvvDisplay = masked ? "•••" : submission.cvv;

  const paymentRows = [
    renderSummaryRow("Card number", cardDisplay),
    renderSummaryRow("Expiration", submission.expiration),
    renderSummaryRow("CVV", cvvDisplay),
    renderSummaryRow("Billing address", submission.billingAddress),
    submission.discountCode
      ? renderSummaryRow("Discount code", submission.discountCode)
      : "",
  ].join("");

  const consentRows = [
    renderSummaryRow(
      "Terms accepted",
      submission.acceptTerms === "yes" ? "Yes" : "No"
    ),
    renderSummaryRow(
      "Marketing emails",
      submission.optInUpdates === "yes" ? "Opted in" : "Not opted in"
    ),
  ].join("");

  return [
    renderSummarySection("Customer Info", customerRows),
    renderSummarySection("Shipping", shippingRows),
    renderSummarySection("Payment", paymentRows),
    renderSummarySection("Consent", consentRows),
  ].join("");
}

/** Compact card for the submissions list */
function renderSubmissionCard(submission) {
  const name = escapeHtml(submission.fullName || "(no name)");
  const email = escapeHtml(submission.email || "(no email)");
  const address = escapeHtml(submission.shippingAddress || "(no address)");
  const deliveryDate = escapeHtml(
    formatDisplayDate(submission.preferredDeliveryDate) ||
      submission.preferredDeliveryDate ||
      "(no date)"
  );
  const submittedAt = escapeHtml(
    formatSubmittedAt(submission.submittedAt) ||
      submission.submittedAt ||
      "(no timestamp)"
  );
  const cardSummary = escapeHtml(
    `${maskCardNumber(submission.cardNumber)} · exp ${submission.expiration || "—"}`
  );

  return `<article class="submission-card">
      <header class="submission-card__header">
        <h2 class="submission-card__name">${name}</h2>
        <time class="submission-card__time" datetime="${escapeHtml(submission.submittedAt || "")}">${submittedAt}</time>
      </header>
      <dl class="submission-card__details">
        <div class="submission-card__row">
          <dt>Email</dt>
          <dd>${email}</dd>
        </div>
        <div class="submission-card__row">
          <dt>Address</dt>
          <dd>${address}</dd>
        </div>
        <div class="submission-card__row">
          <dt>Delivery</dt>
          <dd>${deliveryDate}</dd>
        </div>
        <div class="submission-card__row">
          <dt>Payment</dt>
          <dd>${cardSummary}</dd>
        </div>
      </dl>
    </article>`;
}

function renderSubmissionsPage(submissions) {
  const count = submissions.length;
  const items =
    count === 0
      ? `<p class="empty-state">No submissions yet.</p>`
      : `<div class="submission-list">${submissions
          .slice()
          .reverse()
          .map(renderSubmissionCard)
          .join("")}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>All Submissions</title>
  <style>
    ${DESIGN_TOKENS_CSS}
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 2rem 1.25rem;
      line-height: 1.5;
    }
    .page { max-width: 48rem; margin: 0 auto; }
    .page-header { margin-bottom: 1.5rem; }
    .page-header h1 {
      margin: 0 0 0.375rem;
      font-size: 1.75rem;
      color: var(--accent);
      letter-spacing: -0.02em;
    }
    .page-header p { margin: 0; color: var(--muted); font-size: 0.9375rem; }
    .empty-state {
      background: var(--paper);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 2rem;
      text-align: center;
      color: var(--muted);
    }
    .submission-list { display: flex; flex-direction: column; gap: 1rem; }
    .submission-card {
      background: var(--paper);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 1.25rem 1.375rem;
      box-shadow: 0 8px 24px rgba(42, 36, 24, 0.06);
    }
    .submission-card__header {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.375rem 1rem;
      margin-bottom: 0.875rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border);
    }
    .submission-card__name {
      margin: 0;
      font-size: 1.0625rem;
      font-weight: 600;
      color: var(--text);
    }
    .submission-card__time {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--muted);
      white-space: nowrap;
    }
    .submission-card__details { margin: 0; }
    .submission-card__row {
      display: grid;
      grid-template-columns: 5.5rem 1fr;
      gap: 0.375rem 1rem;
      margin-bottom: 0.375rem;
    }
    .submission-card__row:last-child { margin-bottom: 0; }
    .submission-card__row dt {
      margin: 0;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--muted);
    }
    .submission-card__row dd {
      margin: 0;
      font-size: 0.9375rem;
      word-break: break-word;
    }
    .actions { margin-top: 1.5rem; font-size: 0.9375rem; }
    a { color: var(--accent); }
    @media (max-width: 640px) {
      body { padding: 1.25rem 1rem; }
      .submission-card { padding: 1rem 1.125rem; border-radius: 16px; }
      .submission-card__header { flex-direction: column; align-items: flex-start; gap: 0.25rem; }
      .submission-card__row { grid-template-columns: 1fr; gap: 0.125rem; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="page-header">
      <h1>All submissions</h1>
      <p>${count === 0 ? "Orders will appear here after the form is submitted." : `${count} order${count === 1 ? "" : "s"} on file.`}</p>
    </header>
    ${items}
    <p class="actions"><a href="/">Back to order form</a></p>
  </div>
</body>
</html>`;
}

function renderConfirmationPage(submission) {
  const summary = renderSubmissionSummary(submission, { masked: true });
  const submittedAt = formatSubmittedAt(submission.submittedAt);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Submitted</title>
  <style>
    ${DESIGN_TOKENS_CSS}
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 2rem 1.25rem;
      line-height: 1.5;
    }
    .page { max-width: 40rem; margin: 0 auto; }
    .success-banner {
      background: var(--success-bg);
      border: 1px solid var(--success-border);
      border-radius: 14px;
      padding: 0.875rem 1.125rem;
      margin-bottom: 1.25rem;
      color: var(--success);
      font-size: 0.9375rem;
    }
    .success-banner strong { display: block; font-size: 1rem; margin-bottom: 0.125rem; }
    .card {
      background: var(--paper);
      border: 1px solid var(--border);
      border-radius: 28px;
      padding: 2rem;
      box-shadow: 0 12px 40px rgba(42, 36, 24, 0.08);
    }
    .card-header { margin-bottom: 1.5rem; }
    .card-header h1 {
      margin: 0 0 0.375rem;
      font-size: 1.5rem;
      color: var(--accent);
    }
    .meta { margin: 0; color: var(--muted); font-size: 0.9375rem; }
    .summary-section {
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1rem 1.25rem;
      margin-bottom: 1rem;
      background: rgba(255, 253, 248, 0.6);
    }
    .summary-section:last-of-type { margin-bottom: 0; }
    .summary-section h2 {
      margin: 0 0 0.75rem;
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--text);
    }
    .summary-grid { margin: 0; }
    .summary-row { display: grid; grid-template-columns: 9rem 1fr; gap: 0.5rem 1rem; margin-bottom: 0.5rem; }
    .summary-row:last-child { margin-bottom: 0; }
    .summary-row dt { margin: 0; font-size: 0.8125rem; font-weight: 500; color: var(--muted); }
    .summary-row dd { margin: 0; font-size: 0.9375rem; word-break: break-word; }
    .actions { margin-top: 1.5rem; font-size: 0.9375rem; }
    a { color: var(--accent); }
    @media (max-width: 640px) {
      body { padding: 1.25rem 1rem; }
      .card { padding: 1.25rem; border-radius: 20px; }
      .summary-row { grid-template-columns: 1fr; gap: 0.125rem; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="success-banner" role="status">
      <strong>Order submitted successfully</strong>
      Your order has been saved. Payment details below are masked for display.
    </div>
    <div class="card">
      <header class="card-header">
        <h1>Order confirmation</h1>
        ${submittedAt ? `<p class="meta">Submitted ${escapeHtml(submittedAt)}</p>` : ""}
      </header>
      ${summary}
      <p class="actions"><a href="/">Submit another order</a> · <a href="/submissions">View all submissions</a></p>
    </div>
  </div>
</body>
</html>`;
}

/** Shared card layout for validation error pages */
function renderErrorPage(title, message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    ${DESIGN_TOKENS_CSS}
    body { font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 2rem; }
    .card { max-width: 40rem; margin: 0 auto; background: var(--paper); border: 1px solid var(--border); border-radius: 28px; padding: 2rem; box-shadow: 0 12px 40px rgba(42, 36, 24, 0.08); }
    h1 { color: #b42318; margin-top: 0; font-size: 1.5rem; }
    a { color: var(--accent); }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <p><a href="/">Back to order form</a></p>
  </div>
</body>
</html>`;
}

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

// POST /submit-order — append form data and show confirmation page
app.post("/submit-order", (req, res) => {
  if (!isPhoneValid(req.body.phone)) {
    return res
      .status(400)
      .type("html")
      .send(
        renderErrorPage(
          "Invalid phone number",
          "Phone number must be exactly 10 digits with numbers only."
        )
      );
  }

  const submission = {
    ...req.body,
    id: Date.now(),
    submittedAt: new Date().toISOString(),
  };

  const submissions = readSubmissions();
  submissions.push(submission);
  writeSubmissions(submissions);

  res.type("html").send(renderConfirmationPage(submission));
});

// GET /submissions — list every saved submission
app.get("/submissions", (req, res) => {
  const submissions = readSubmissions();
  res.type("html").send(renderSubmissionsPage(submissions));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Order form server running on port ${PORT}`);
});
