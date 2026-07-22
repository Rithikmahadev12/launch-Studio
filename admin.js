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
            <label>Client email</label>
            <input type="email" data-field="email" value="${escapeHtml(site.email || '')}">
          </div>
          <div class="field">
            <label>Client phone</label>
            <input type="text" data-field="phone" value="${escapeHtml(site.phone || '')}">
          </div>
        </div>
        <div class="field">
          <label>Notes (internal only)</label>
          <textarea rows="2" data-field="notes">${escapeHtml(site.notes || '')}</textarea>
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
          payload[el.getAttribute('data-field')] = el.type === 'number' ? Number(el.value) : el.value;
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
    wireLogout();
    loadSites();
  })();
})();
