# Launch Studio

Marketing site for Launch Studio — a studio that designs, builds, and ships websites for small businesses, founders, and independent creators.

Plain HTML/CSS/JS. No build step, no framework, no dependencies.

## Files

- `index.html` — all page content and sections
- `styles.css` — design tokens (colors, type, spacing) and layout
- `script.js` — mobile nav toggle, contact form handling, hero console animation
- `render.yaml` — Render Blueprint so the site deploys with one click

## Before you launch this for real

- [ ] Replace the four items in the "Sites we've shipped" section with your own real client work (or take them down until you have some)
- [ ] Swap `hello@launchstudio.co` for your real email in `index.html`
- [ ] Wire the contact form to something that actually delivers submissions — a static site has no backend of its own. Easiest options: [Formspree](https://formspree.io), [Getform](https://getform.io), or Render's own [Netlify Forms](https://docs.netlify.com/forms/setup/) equivalent if you host there instead
- [ ] Update the pricing numbers if they don't match what you actually charge
- [ ] Point your real domain at the deployed site (see below)

## Put it on GitHub

From inside this folder:

```bash
git init
git add .
git commit -m "Launch Studio site"
```

Then create a new empty repo on GitHub (no README/license, so it stays empty) at:
https://github.com/new

Connect and push:

```bash
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/launch-studio.git
git push -u origin main
```

## Deploy on Render

**Option A — Blueprint (fastest):**
1. Push the repo to GitHub (above) — `render.yaml` is already in the repo.
2. In the Render dashboard, click **New > Blueprint**.
3. Connect your GitHub account, pick the `launch-studio` repo.
4. Render reads `render.yaml` and sets up a Static Site automatically — click **Apply**.

**Option B — Manual:**
1. In the Render dashboard, click **New > Static Site**.
2. Connect the `launch-studio` GitHub repo.
3. Leave **Build Command** empty and set **Publish Directory** to `.` (the repo root).
4. Click **Create Static Site**.

Either way, Render gives you a live URL like `launch-studio.onrender.com` within a minute or two, and redeploys automatically every time you push to `main`.

### Custom domain

In the Render dashboard for this site, go to **Settings > Custom Domains**, add your domain, and point its DNS at Render following the instructions Render shows you there (usually a CNAME or A record).
