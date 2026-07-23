document.getElementById('year').textContent = new Date().getFullYear();

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function splitContactList(value) {
  if (!value) return [];
  return String(value)
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

(async function loadContactInfo() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    const settings = await res.json();
    const emailsWrap = document.getElementById('contactEmails');
    const phonesWrap = document.getElementById('contactPhones');

    const emails = splitContactList(settings.contact_email);
    const phones = splitContactList(settings.contact_phone);

    if (emailsWrap && emails.length) {
      emailsWrap.innerHTML = emails
        .map((e) => `<a href="mailto:${escapeHtml(e)}">${escapeHtml(e)}</a>`)
        .join(', ');
    }
    if (phonesWrap && phones.length) {
      phonesWrap.textContent = ` · ${phones.join(' · ')}`;
    }
  } catch (err) {
    // Non-critical — the static fallback email in the HTML still works.
  }
})();

// Mobile nav toggle (same behavior as the homepage)
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const open = navLinks.style.display === 'flex';
    navLinks.style.display = open ? 'none' : 'flex';
    navToggle.setAttribute('aria-expanded', String(!open));
  });
}
