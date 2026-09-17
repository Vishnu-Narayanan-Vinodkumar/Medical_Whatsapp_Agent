(() => {
  const key = 'diagnobot-theme';
  const preference = window.matchMedia('(prefers-color-scheme: dark)');
  const stored = () => {
    try { const value = localStorage.getItem(key); return ['light', 'dark'].includes(value) ? value : null; }
    catch { return null; }
  };
  let selected = stored();
  let button;
  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#171c1a' : '#ffffff';
    if (!button) return;
    const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    button.title = label;
    button.setAttribute('aria-label', label);
    const icon = document.createElement('i');
    icon.dataset.lucide = theme === 'dark' ? 'sun' : 'moon';
    button.replaceChildren(icon);
    window.lucide?.createIcons();
  }
  const current = () => selected || (preference.matches ? 'dark' : 'light');
  apply(current());
  preference.addEventListener('change', () => { if (!selected) apply(current()); });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    selected = stored();
    apply(current());
  });
  document.addEventListener('DOMContentLoaded', () => {
    const actions = document.querySelector('.site-header .header-actions');
    if (!actions) return;
    button = document.createElement('button');
    button.id = 'theme-toggle';
    button.type = 'button';
    button.className = 'icon-button';
    button.addEventListener('click', () => {
      selected = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, selected); } catch { return apply(selected); }
      apply(selected);
    });
    actions.prepend(button);
    apply(current());
  }, { once: true });
})();