document.getElementById('year').textContent = new Date().getFullYear();

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function starString(rating) {
  const r = Math.max(1, Math.min(5, Math.round(Number(rating) || 5)));
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}

(async function loadReviews() {
  const cardsWrap = document.getElementById('reviewCards');
  const summary = document.getElementById('reviewsSummary');
  try {
    const res = await fetch('/api/reviews');
    if (!res.ok) throw new Error('failed to load reviews');
    const reviews = await res.json();

    if (!Array.isArray(reviews) || reviews.length === 0) {
      cardsWrap.innerHTML = '<p class="loading-note">No reviews yet — check back soon.</p>';
      return;
    }

    const avg = reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length;
    if (summary) {
      summary.hidden = false;
      summary.innerHTML = `<span class="stars">${starString(Math.round(avg))}</span> ${avg.toFixed(1)} average from ${reviews.length} review${reviews.length === 1 ? '' : 's'}`;
    }

    cardsWrap.innerHTML = reviews.map((r) => `
      <article class="review-card">
        <span class="stars">${starString(r.rating)}</span>
        <p class="review-quote">${escapeHtml(r.quote)}</p>
        <p class="review-name">${escapeHtml(r.client_name)}</p>
      </article>
    `).join('');
  } catch (err) {
    cardsWrap.innerHTML = '<p class="loading-note">Couldn\'t load reviews right now — try again in a bit.</p>';
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
