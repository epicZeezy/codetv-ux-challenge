# codetv-ux-challenge

HTML/CSS order form with an Express backend for form submission.

## Local development

```bash
cd order-form-backend
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Render

This repo includes a [`render.yaml`](render.yaml) blueprint for one-click deployment.

### Option A: Blueprint (recommended)

1. Push this repo to GitHub.
2. In [Render](https://render.com), click **New → Blueprint**.
3. Connect the repo and apply the blueprint.
4. Render creates a web service from `order-form-backend` with:
   - **Build command:** `npm install`
   - **Start command:** `npm start`

### Option B: Manual web service

1. In Render, click **New → Web Service** and connect the repo.
2. Set **Root Directory** to `order-form-backend`.
3. Set **Build Command** to `npm install`.
4. Set **Start Command** to `npm start`.
5. Deploy.

The app listens on `process.env.PORT`, which Render sets automatically.

### Notes

- Form submissions are saved to `submissions.json` on the server filesystem. On Render’s free tier, that file is ephemeral and may reset on redeploy or restart.
- View saved submissions at `/submissions` after submitting the form.
