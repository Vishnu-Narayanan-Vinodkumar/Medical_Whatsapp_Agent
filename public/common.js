(() => {
  const state = { user: null, csrf: '', expires: 0, config: null };
  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const icons = () => window.lucide.createIcons();
  const icon = name => { const node = el('i'); node.dataset.lucide = name; return node; };
  const flash = (message, success = false) => {
    const node = document.getElementById('flash');
    node.textContent = message;
    node.className = `notice ${success ? 'success-notice' : 'error-notice'}`;
    node.hidden = !message;
  };
  async function api(url, body) {
    let response;
    try {
      response = await fetch(url, {
        method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-DiagnoBot': '1', 'X-CSRF-Token': state.csrf },
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(url === '/api/beta/chat' ? 40000 : 30000),
      });
    } catch { throw new Error('Unable to reach the service. Please try again.'); }
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || 'The request could not be completed.');
      error.status = response.status;
      if (response.status === 401 && state.user) {
        state.user = null;
        state.csrf = '';
        window.dispatchEvent(new Event('session-expired'));
      }
      throw error;
    }
    if (data.csrf) state.csrf = data.csrf;
    if (data.expires_at) state.expires = new Date(data.expires_at).getTime();
    if (data.user) state.user = data.user;
    return data;
  }
  function link(text, href, iconName) {
    try {
      const url = new URL(href);
      if (url.protocol !== 'https:') return null;
      const anchor = el('a', text);
      anchor.href = url.href;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      if (iconName) anchor.prepend(icon(iconName));
      return anchor;
    } catch { return null; }
  }
  const label = value => String(value || 'unknown').replaceAll('_', ' ');
  const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not available';
  window.Diagno = { state, el, icon, icons, flash, api, link, label, date };
})();