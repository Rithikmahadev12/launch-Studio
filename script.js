// Year in footer
document.getElementById('year').textContent = new Date().getFullYear();

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
