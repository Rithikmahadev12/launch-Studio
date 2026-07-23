(function () {
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  async function checkSession() {
    const res = await fetch('/api/session');
    const data = await res.json();
    if (!data.isAdmin) {
      window.location.href = '/admin/login.html';
      throw new Error('not admin');
    }
  }

  async function loadSettings() {
    const res = await fetch('/api/settings');
    const settings = await res.json();
    document.getElementById('contact_email').value = settings.contact_email || '';
    document.getElementById('contact_phone').value = settings.contact_phone || '';
  }

  function wireSettingsForm() {
    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      // Textareas hold one email/phone per line — stored as-is, and split
      // back out on the public pages.
      const contact_email = document.getElementById('contact_email').value.trim();
      const contact_phone = document.getElementById('contact_phone').value.trim();
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_email, contact_phone }),
      });
      const saved = document.getElementById('settingsSaved');
      saved.hidden = false;
      setTimeout(() => (saved.hidden = true), 2000);
    });
  }

  function wireAddForm() {
    document.getElementById('addSiteForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        client_name: document.getElementById('client_name').value.trim(),
        site_name: document.getElementById('site_name').value.trim(),
        status: document.getElementById('status').value,
        progress: Number(document.getElementById('progress').value) || 0,
        live_url: document.getElementById('live_url').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        notes: document.getElementById('notes').value.trim(),
        category: document.getElementById('category').value.trim(),
        description: document.getElementById('description').value.trim(),
        featured: document.getElementById('featured').checked,
      };
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        e.target.reset();
        document.getElementById('progress').value = 0;
        loadSites();
      } else {
        const err = await res.json();
        alert(err.error || 'Could not add site');
      }
    });
  }

  function siteRowHtml(site) {
    return `
      <div class="admin-site-row" data-id="${site.id}">
        <div class="admin-site-row-top">
          <h3>${escapeHtml(site.site_name)}</h3>
          <a class="admin-site-link" href="/progress/${encodeURIComponent(site.slug)}" target="_blank">/progress/${escapeHtml(site.slug)} ↗</a>
        </div>
        <div class="admin-form-grid">
          <div class="field">
            <label>Client name</label>
            <input type="text" data-field="client_name" value="${escapeHtml(site.client_name)}">
          </div>
          <div class="field">
            <label>Site name</label>
            <input type="text" data-field="site_name" value="${escapeHtml(site.site_name)}">
          </div>
          <div class="field">
            <label>Status</label>
            <select data-field="status">
              ${['In Design', 'Building', 'In Review', 'Live'].map(
                (s) => `<option ${s === site.status ? 'selected' : ''}>${s}</option>`
              ).join('')}
            </select>
          </div>
          <div class="field">
            <label>Progress (%)</label>
            <input type="number" min="0" max="100" data-field="progress" value="${site.progress}">
          </div>
          <div class="field">
            <label>Live URL</label>
            <input type="url" data-field="live_url" value="${escapeHtml(site.live_url || '')}">
          </div>
          <div class="field">
            <label>Category tag (for homepage)</label>
            <input type="text" data-field="category" value="${escapeHtml(site.category || '')}">
          </div>
          <div class="field">
            <label>Client email</label>
            <input type="email" data-field="email" value="${escapeHtml(site.email || '')}">
          </div>
          <div class="field">
            <label>Client phone</label>
            <input type="text" data-field="phone" value="${escapeHtml(site.phone || '')}">
          </div>
        </div>
        <div class="field">
          <label>Short description (for homepage launch card)</label>
          <input type="text" data-field="description" value="${escapeHtml(site.description || '')}">
        </div>
        <div class="field">
          <label>Notes (internal only)</label>
          <textarea rows="2" data-field="notes">${escapeHtml(site.notes || '')}</textarea>
        </div>
        <div class="field admin-checkbox-field">
          <label><input type="checkbox" data-field="featured" ${site.featured ? 'checked' : ''}> Show on homepage "Recent launches" (needs a Live URL)</label>
        </div>
        <div class="admin-row-actions">
          <button class="btn btn-primary btn-sm save-btn">Save changes</button>
          <button class="btn btn-danger btn-sm delete-btn">Delete</button>
          <span class="admin-saved row-saved" hidden>Saved</span>
        </div>
      </div>
    `;
  }

  async function loadSites() {
    const container = document.getElementById('sitesList');
    const res = await fetch('/api/sites');
    const sites = await res.json();
    if (!Array.isArray(sites) || sites.length === 0) {
      container.innerHTML = '<p class="loading-note">No client sites yet — add one above.</p>';
      return;
    }
    container.innerHTML = sites.map(siteRowHtml).join('');
    wireSiteRows();
  }

  function wireSiteRows() {
    document.querySelectorAll('.admin-site-row').forEach((row) => {
      const id = row.getAttribute('data-id');

      row.querySelector('.save-btn').addEventListener('click', async () => {
        const payload = {};
        row.querySelectorAll('[data-field]').forEach((el) => {
          if (el.type === 'checkbox') {
            payload[el.getAttribute('data-field')] = el.checked;
          } else if (el.type === 'number') {
            payload[el.getAttribute('data-field')] = Number(el.value);
          } else {
            payload[el.getAttribute('data-field')] = el.value;
          }
        });
        const res = await fetch(`/api/sites/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const saved = row.querySelector('.row-saved');
          saved.hidden = false;
          setTimeout(() => (saved.hidden = true), 2000);
        } else {
          alert('Could not save changes');
        }
      });

      row.querySelector('.delete-btn').addEventListener('click', async () => {
        if (!confirm('Delete this client site? This cannot be undone.')) return;
        const res = await fetch(`/api/sites/${id}`, { method: 'DELETE' });
        if (res.ok) {
          row.remove();
        } else {
          alert('Could not delete');
        }
      });
    });
  }

  function pricingFormHtml(plan) {
    return `
      <form class="admin-pricing-form" data-slug="${escapeHtml(plan.slug)}">
        <h3>${escapeHtml(plan.name)}</h3>
        <div class="admin-form-grid">
          <div class="field">
            <label>Price</label>
            <input type="text" data-field="price" value="${escapeHtml(plan.price)}">
          </div>
          <div class="field">
            <label>Button text</label>
            <input type="text" data-field="cta_label" value="${escapeHtml(plan.cta_label)}">
          </div>
        </div>
        <div class="field">
          <label>Subtitle</label>
          <input type="text" data-field="subtitle" value="${escapeHtml(plan.subtitle)}">
        </div>
        <div class="field">
          <label>Features (one per line)</label>
          <textarea rows="4" data-field="features">${escapeHtml(plan.features)}</textarea>
        </div>
        <div class="field">
          <label>"Good for" line</label>
          <input type="text" data-field="good_for" value="${escapeHtml(plan.good_for)}">
        </div>
        <div class="admin-row-actions">
          <button type="submit" class="btn btn-primary btn-sm">Save ${escapeHtml(plan.name)}</button>
          <span class="admin-saved plan-saved" hidden>Saved</span>
        </div>
      </form>
    `;
  }

  async function loadPricing() {
    const container = document.getElementById('pricingForms');
    const res = await fetch('/api/pricing');
    const plans = await res.json();
    container.innerHTML = plans.map(pricingFormHtml).join('');
    wirePricingForms();
  }

  function wirePricingForms() {
    document.querySelectorAll('.admin-pricing-form').forEach((form) => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const slug = form.getAttribute('data-slug');
        const payload = {};
        form.querySelectorAll('[data-field]').forEach((el) => {
          payload[el.getAttribute('data-field')] = el.value;
        });
        const res = await fetch(`/api/pricing/${slug}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const saved = form.querySelector('.plan-saved');
          saved.hidden = false;
          setTimeout(() => (saved.hidden = true), 2000);
        } else {
          alert('Could not save pricing');
        }
      });
    });
  }

  function reviewRowHtml(review) {
    return `
      <div class="admin-site-row" data-id="${review.id}">
        <div class="admin-form-grid">
          <div class="field">
            <label>Client / business name</label>
            <input type="text" data-field="client_name" value="${escapeHtml(review.client_name)}">
          </div>
          <div class="field">
            <label>Rating (1–5)</label>
            <input type="number" min="1" max="5" data-field="rating" value="${review.rating}">
          </div>
        </div>
        <div class="field">
          <label>Review</label>
          <textarea rows="3" data-field="quote">${escapeHtml(review.quote)}</textarea>
        </div>
        <div class="field admin-checkbox-field">
          <label><input type="checkbox" data-field="published" ${review.published ? 'checked' : ''}> Published</label>
        </div>
        <div class="admin-row-actions">
          <button class="btn btn-primary btn-sm save-review-btn">Save changes</button>
          <button class="btn btn-danger btn-sm delete-review-btn">Delete</button>
          <span class="admin-saved row-saved" hidden>Saved</span>
        </div>
      </div>
    `;
  }

  async function loadReviews() {
    const container = document.getElementById('reviewsList');
    const res = await fetch('/api/reviews');
    const reviews = await res.json();
    if (!Array.isArray(reviews) || reviews.length === 0) {
      container.innerHTML = '<p class="loading-note">No reviews yet — add one above.</p>';
      return;
    }
    container.innerHTML = reviews.map(reviewRowHtml).join('');
    wireReviewRows();
  }

  function wireReviewRows() {
    document.querySelectorAll('#reviewsList .admin-site-row').forEach((row) => {
      const id = row.getAttribute('data-id');

      row.querySelector('.save-review-btn').addEventListener('click', async () => {
        const payload = {};
        row.querySelectorAll('[data-field]').forEach((el) => {
          if (el.type === 'checkbox') {
            payload[el.getAttribute('data-field')] = el.checked;
          } else if (el.type === 'number') {
            payload[el.getAttribute('data-field')] = Number(el.value);
          } else {
            payload[el.getAttribute('data-field')] = el.value;
          }
        });
        const res = await fetch(`/api/reviews/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const saved = row.querySelector('.row-saved');
          saved.hidden = false;
          setTimeout(() => (saved.hidden = true), 2000);
        } else {
          alert('Could not save review');
        }
      });

      row.querySelector('.delete-review-btn').addEventListener('click', async () => {
        if (!confirm('Delete this review? This cannot be undone.')) return;
        const res = await fetch(`/api/reviews/${id}`, { method: 'DELETE' });
        if (res.ok) {
          row.remove();
        } else {
          alert('Could not delete review');
        }
      });
    });
  }

  function wireAddReviewForm() {
    document.getElementById('addReviewForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        client_name: document.getElementById('review_client_name').value.trim(),
        rating: Number(document.getElementById('review_rating').value) || 5,
        quote: document.getElementById('review_quote').value.trim(),
        published: document.getElementById('review_published').checked,
      };
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        e.target.reset();
        document.getElementById('review_rating').value = 5;
        document.getElementById('review_published').checked = true;
        loadReviews();
      } else {
        const err = await res.json();
        alert(err.error || 'Could not add review');
      }
    });
  }

  function wireLogout() {
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      window.location.href = '/admin/login.html';
    });
  }

  (async function init() {
    try {
      await checkSession();
    } catch (e) {
      return;
    }
    loadSettings();
    wireSettingsForm();
    wireAddForm();
    wireAddReviewForm();
    wireLogout();
    loadSites();
    loadPricing();
    loadReviews();
  })();
})();
