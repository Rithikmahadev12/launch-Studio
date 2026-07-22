(function () {
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function statusBadge(status) {
    return `<span class="status-badge">${escapeHtml(status)}</span>`;
  }

  function siteCardHtml(site) {
    return `
      <a class="site-card" href="/progress/${encodeURIComponent(site.slug)}">
        <div class="site-card-top">
          <h3>${escapeHtml(site.site_name)}</h3>
          ${statusBadge(site.status)}
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${site.progress}%"></div>
        </div>
        <div class="progress-percent">${site.progress}% complete</div>
      </a>
    `;
  }

  function siteDetailHtml(site) {
    const liveLink = site.live_url
      ? `<a class="detail-live-link" href="${escapeHtml(site.live_url)}" target="_blank" rel="noopener">Visit the live site →</a>`
      : '';
    return `
      <div class="detail-card">
        <h1>${escapeHtml(site.site_name)}</h1>
        <p class="detail-meta">For ${escapeHtml(site.client_name)} · last updated ${escapeHtml(formatDate(site.updated_at))}</p>
        ${statusBadge(site.status)}
        <div class="progress-track">
          <div class="progress-fill" style="width:${site.progress}%"></div>
        </div>
        <div class="progress-percent">${site.progress}% complete</div>
        ${liveLink}
      </div>
    `;
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso.replace(' ', 'T') + 'Z');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function getSlugFromPath() {
    const match = window.location.pathname.match(/^\/progress\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  async function loadList() {
    const listView = document.getElementById('listView');
    const detailView = document.getElementById('detailView');
    detailView.hidden = true;
    listView.hidden = false;

    const container = document.getElementById('siteList');
    try {
      const res = await fetch('/api/sites');
      const sites = await res.json();
      if (!Array.isArray(sites) || sites.length === 0) {
        container.innerHTML = '<p class="loading-note">No projects listed yet — check back soon.</p>';
        return;
      }
      container.innerHTML = sites.map(siteCardHtml).join('');
    } catch (err) {
      container.innerHTML = '<p class="loading-note">Couldn\'t load projects right now.</p>';
    }
  }

  async function loadDetail(slug) {
    const listView = document.getElementById('listView');
    const detailView = document.getElementById('detailView');
    listView.hidden = true;
    detailView.hidden = false;

    const container = document.getElementById('siteDetail');
    container.innerHTML = '<p class="loading-note">Loading…</p>';
    try {
      const res = await fetch(`/api/sites/${encodeURIComponent(slug)}`);
      if (res.status === 404) {
        container.innerHTML = '<p class="not-found">We couldn\'t find a project at that link.</p>';
        return;
      }
      const site = await res.json();
      container.innerHTML = siteDetailHtml(site);
    } catch (err) {
      container.innerHTML = '<p class="not-found">Couldn\'t load this project right now.</p>';
    }
  }

  async function loadFooterContact() {
    try {
      const res = await fetch('/api/settings');
      const settings = await res.json();
      const year = new Date().getFullYear();
      const parts = [`© ${year} Launch Studio.`];
      if (settings.contact_email) parts.push(`<a href="mailto:${escapeHtml(settings.contact_email)}">${escapeHtml(settings.contact_email)}</a>`);
      if (settings.contact_phone) parts.push(escapeHtml(settings.contact_phone));
      document.getElementById('footerContact').innerHTML = parts.join(' · ');
    } catch (err) {
      /* non-critical */
    }
  }

  const slug = getSlugFromPath();
  if (slug) {
    loadDetail(slug);
  } else {
    loadList();
  }
  loadFooterContact();
})();
