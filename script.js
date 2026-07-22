// Year in footer
document.getElementById('year').textContent = new Date().getFullYear();

// Pull the studio's contact email/phone from the backend so admin edits
// (made in /admin) show up here without needing a redeploy.
(async function loadContactInfo() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    const settings = await res.json();
    const emailLink = document.getElementById('contactEmailLink');
    const note = document.getElementById('contactNote');
    if (emailLink && settings.contact_email) {
      emailLink.href = `mailto:${settings.contact_email}`;
      emailLink.textContent = settings.contact_email;
    }
    if (note && settings.contact_phone) {
      note.append(` · ${settings.contact_phone}`);
    }
  } catch (err) {
    // Non-critical — the static fallback email in the HTML still works.
  }
})();

// Recent launches: pulled from sites marked "featured" in /admin. Starts
// empty until you ship your first client site and flip that toggle.
(async function loadLaunches() {
  const list = document.getElementById('launchesList');
  const note = document.getElementById('launchesNote');
  if (!list) return;
  try {
    const res = await fetch('/api/sites');
    if (!res.ok) throw new Error('failed to load sites');
    const sites = await res.json();
    const launches = sites.filter((s) => s.featured && s.live_url);

    if (launches.length === 0) {
      if (note) note.textContent = "We're just getting started — check back soon for shipped projects.";
      list.innerHTML = '';
      return;
    }

    if (note) note.textContent = 'Selected work from clients we\u2019ve shipped for.';
    list.innerHTML = launches.map((site) => {
      let displayUrl = site.live_url;
      try {
        const u = new URL(site.live_url);
        displayUrl = u.hostname + (u.pathname !== '/' ? u.pathname : '');
      } catch (e) {
        // live_url wasn't a full URL — show it as typed.
      }
      const safeUrl = site.live_url.replace(/"/g, '&quot;');
      return `
        <li class="log-row">
          <span class="dot" aria-hidden="true"></span>
          <span class="log-name">${escapeHtml(displayUrl)}</span>
          <span class="log-desc">${escapeHtml(site.description || '')}</span>
          <span class="log-tag">${escapeHtml(site.category || '')}</span>
          <a href="${safeUrl}" class="log-link" target="_blank" rel="noopener">visit →</a>
        </li>
      `;
    }).join('');
  } catch (err) {
    if (note) note.textContent = "We're just getting started — check back soon for shipped projects.";
  }
})();

// Pricing: tiers are fixed (starter/studio/custom) but their price and copy
// are editable in /admin, so pull the live values in on load.
(async function loadPricing() {
  const cardsWrap = document.getElementById('pricingCards');
  if (!cardsWrap) return;
  try {
    const res = await fetch('/api/pricing');
    if (!res.ok) return;
    const plans = await res.json();
    plans.forEach((plan) => {
      const card = cardsWrap.querySelector(`[data-plan="${plan.slug}"]`);
      if (!card) return;
      const priceEl = card.querySelector('[data-field="price"]');
      const subtitleEl = card.querySelector('[data-field="subtitle"]');
      const featuresEl = card.querySelector('[data-field="features"]');
      const goodForEl = card.querySelector('[data-field="good_for"]');
      const ctaEl = card.querySelector('[data-field="cta_label"]');
      if (priceEl) priceEl.textContent = plan.price;
      if (subtitleEl) subtitleEl.textContent = plan.subtitle;
      if (goodForEl) goodForEl.textContent = plan.good_for;
      if (ctaEl) ctaEl.textContent = plan.cta_label;
      if (featuresEl && plan.features) {
        const items = plan.features.split('\n').map((f) => f.trim()).filter(Boolean);
        featuresEl.innerHTML = items.map((f) => `<li>${escapeHtml(f)}</li>`).join('');
      }
    });
  } catch (err) {
    // Non-critical — the static fallback pricing in the HTML still works.
  }
})();

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

// Mobile nav toggle
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const open = navLinks.style.display === 'flex';
    navLinks.style.display = open ? 'none' : 'flex';
    navToggle.setAttribute('aria-expanded', String(!open));
  });
}

// Contact form: no backend on a static host, so we confirm locally.
// To actually receive submissions, wire this up to a form service
// (Formspree, Netlify Forms, Getform, etc.) — see README.
const form = document.getElementById('contactForm');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    form.innerHTML = `<p style="margin:0;">Thanks${name ? ', ' + name : ''} — we've got your project details. We reply within a day or two.</p>`;
  });
}

// Deploy console animation
const consoleBody = document.getElementById('consoleBody');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const logLines = [
  { text: '$ launch deploy marlowcoffee.com', delay: 25 },
  { text: '  building…', delay: 15 },
  { text: '  optimizing images', delay: 15 },
  { text: '  ✓ deployed — marlowcoffee.com is live', pause: 700 },
  { text: '', pause: 200 },
  { text: '$ launch deploy rivetfurniture.co', delay: 25 },
  { text: '  building…', delay: 15 },
  { text: '  running checks', delay: 15 },
  { text: '  ✓ deployed — rivetfurniture.co is live', pause: 700 },
  { text: '', pause: 200 },
  { text: '$ launch deploy thepaperroute.studio', delay: 25 },
  { text: '  building…', delay: 15 },
  { text: '  ✓ deployed — thepaperroute.studio is live', pause: 900 },
];

function renderStaticConsole() {
  consoleBody.textContent = logLines
    .filter(l => l.text)
    .map(l => l.text)
    .join('\n');
}

async function typeLine(text, delay) {
  for (let i = 0; i <= text.length; i++) {
    consoleBody.textContent += text.slice(i - 1, i);
    if (i > 0) await sleep(delay);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runConsole() {
  consoleBody.textContent = '';
  for (const line of logLines) {
    await typeLine(line.text, line.delay || 12);
    consoleBody.textContent += '\n';
    if (line.pause) await sleep(line.pause);
  }
  await sleep(1200);
  runConsole(); // loop
}

if (consoleBody) {
  if (prefersReducedMotion) {
    renderStaticConsole();
  } else {
    runConsole();
  }
}
