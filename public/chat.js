(() => {
  const { state, el, icon, icons, flash, api, link, label, date } = window.Diagno;
  const byId = id => document.getElementById(id);
  let registering = false;
  let sending = false;
  let ticket = null;
  let supportSnapshot = '';
  let resetToken = '';

  function authMode(register) {
    registering = register;
    byId('auth-title').textContent = register ? 'Create your account' : 'Sign in';
    byId('auth-submit').querySelector('span').textContent = register ? 'Create account' : 'Sign in';
    byId('login-tab').setAttribute('aria-pressed', String(!register));
    byId('register-tab').setAttribute('aria-pressed', String(register));
    for (const field of ['name-field', 'consent-field', 'password-hint']) byId(field).hidden = !register;
    byId('full-name').required = register;
    byId('consent').required = register;
    byId('password').minLength = register ? 12 : 1;
    byId('password').autocomplete = register ? 'new-password' : 'current-password';
  }
  function signedOut() {
    state.user = null;
    state.csrf = '';
    ticket = null;
    supportSnapshot = '';
    byId('auth-screen').hidden = false;
    byId('chat-screen').hidden = true;
    byId('logout').hidden = true;
    byId('admin-link').hidden = true;
    byId('account-name').textContent = '';
    byId('messages').replaceChildren();
    byId('support-messages').replaceChildren();
    byId('support-panel').hidden = true;
    byId('support-panel').classList.remove('support-closed');
    byId('support-input').value = '';
    window.dispatchEvent(new Event('patient-signed-out'));
  }
  function signedIn() {
    byId('auth-screen').hidden = true;
    byId('chat-screen').hidden = false;
    byId('logout').hidden = false;
    byId('admin-link').hidden = state.user.role !== 'admin';
    byId('account-name').textContent = state.user.full_name;
    byId('password').value = '';
    byId('messages').replaceChildren();
    message('assistant', `Hello, ${state.user.full_name}. What would you like to ask about today?`);
    byId('message-input').focus();
    flash('');
    sessionClock();
    pollSupport();
    window.dispatchEvent(new Event('patient-signed-in'));
  }
  function message(role, text) {
    const item = el('article', undefined, `message ${role}`);
    const heading = el('div', role === 'user' ? 'You' : 'DiagnoBot', 'message-label');
    if (role !== 'user') heading.prepend(icon('activity'));
    item.append(heading, el('p', text, 'message-text'));
    byId('messages').append(item);
    icons();
    return item;
  }
  function renderResult(result) {
    const item = message('assistant', result.message);
    const list = el('div', undefined, 'result-list');
    for (const report of result.reports || []) {
      const row = el('div', undefined, 'result-row');
      const heading = el('div', undefined, 'section-heading');
      heading.append(el('h3', report.name), el('span', label(report.status), `status-tag ${report.status}`));
      row.append(heading, el('p', `Sample: ${date(report.sample_date)}`));
      if (report.report_date) row.append(el('p', `Reported: ${date(report.report_date)}`));
      if (report.estimated_ready_time) row.append(el('p', `Estimated ready: ${date(report.estimated_ready_time)}`));
      const download = link('Open report', report.download_url, 'external-link');
      if (download) row.append(download, el('p', `Link expires: ${date(report.url_expires_at)}`));
      list.append(row);
    }
    for (const centre of result.centres || []) {
      const row = el('div', undefined, 'result-row');
      row.append(el('h3', centre.name), el('p', centre.address), el('p', centre.hours), el('p', `Parking: ${centre.parking}`));
      if (centre.holiday_today) row.append(el('p', 'Closed for a listed holiday today. Contact the centre before visiting.'));
      const maps = link('View area on map', centre.maps_url, 'map-pin');
      if (maps) row.append(maps);
      if (/^\+[1-9]\d{7,14}$/.test(centre.phone || '')) { const phone = el('a', centre.phone); phone.href = `tel:${centre.phone}`; row.append(phone); }
      list.append(row);
    }
    for (const product of result.pricing || []) {
      const row = el('div', undefined, 'result-row');
      const heading = el('div', undefined, 'section-heading');
      heading.append(el('h3', product.name), el('span', new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(product.price), 'price'));
      row.append(heading, el('p', `${product.category} | ${product.included}`), el('p', `Turnaround: ${product.turnaround}`));
      if (product.promotion) row.append(el('p', `${product.promotion.text} | Until ${product.promotion.ends}`));
      list.append(row);
    }
    if (list.children.length) item.append(list);
    if (result.pricing?.length) {
      const book = el('button', 'Request an appointment', 'secondary');
      book.prepend(icon('calendar-plus'));
      book.addEventListener('click', () => window.DiagnoBeta.showBooking());
      item.append(book);
    }
    if (result.requires_escalation) {
      const actions = el('div', undefined, 'button-row');
      const confirm = el('button', 'Connect to support', 'primary');
      const decline = el('button', 'Not now', 'secondary');
      confirm.addEventListener('click', async () => {
        confirm.disabled = true;
        try { const created = await api('/api/escalations', { consent: true }); message('assistant', created.message); actions.remove(); await pollSupport(); }
        catch (error) { flash(error.message); confirm.disabled = false; }
      });
      decline.addEventListener('click', () => { actions.remove(); message('assistant', 'No support request was created. You can continue your conversation.'); });
      actions.append(confirm, decline);
      item.append(actions);
    }
    window.DiagnoBeta.render(item, result);
    icons();
    byId('messages').scrollTop = byId('messages').scrollHeight;
  }
  async function send(text, action) {
    if (sending || !state.user || !text.trim()) return;
    sending = true;
    state.responsePending = true;
    flash('');
    byId('send').disabled = true;
    byId('message-state').textContent = 'Responding...';
    const userId = state.user.id;
    message('user', text);
    try {
      const beta = window.DiagnoBeta.enabled() && !action;
      const result = await api(beta ? '/api/beta/chat' : '/api/chat', { message: text, ...(action ? { action } : {}), ...(beta ? { city: window.DiagnoBeta.city(), use_web: window.DiagnoBeta.useWeb() } : {}) });
      if (state.user?.id === userId) {
        renderResult(result);
        if (byId('message-input').value === text) byId('message-input').value = '';
        byId('message-state').textContent = `${(result.response_time_ms / 1000).toFixed(1)}s`;
      }
    } catch (error) { flash(error.message); byId('message-state').textContent = 'Message not completed'; }
    finally { sending = false; state.responsePending = false; byId('send').disabled = false; }
  }
  async function pollSupport() {
    if (!state.user || document.hidden) return;
    const userId = state.user.id;
    try {
      const result = await api('/api/escalations');
      if (state.user?.id !== userId) return;
      ticket = result.ticket;
      const isClosed = byId('support-panel').classList.contains('support-closed');
      byId('support-panel').hidden = !ticket || isClosed;
      if (!ticket || isClosed) return;
      byId('ticket-status').textContent = label(ticket.status);
      byId('ticket-status').className = `status-tag ${ticket.status}`;
      const minutes = Math.floor((Date.now() - new Date(ticket.created_at).getTime()) / 60000);
      byId('ticket-note').textContent = ticket.status === 'resolved' ? 'This request is closed.' : ticket.status === 'assigned' ? 'An operator has accepted your request.' : minutes >= 2 ? 'No operator has accepted yet. You may contact your centre directly.' : 'Waiting for an operator. Response time is not guaranteed.';
      byId('support-form').hidden = ticket.status === 'resolved';
      const snapshot = JSON.stringify(result.messages);
      if (snapshot !== supportSnapshot) {
        byId('support-messages').replaceChildren(...result.messages.map(entry => el('div', `${entry.author === 'agent' ? 'Operator' : 'You'}: ${entry.content}`, 'support-message')));
        supportSnapshot = snapshot;
      }
    } catch (error) { if (error.status !== 401) flash(error.message); }
  }
  function sessionClock() {
    if (!state.user) return;
    const remaining = state.expires - Date.now();
    if (remaining <= 0) { signedOut(); flash('Your session has expired. Sign in again to continue.'); return; }
    byId('session-warning').hidden = remaining > 300000;
    byId('session-label').textContent = `${Math.ceil(remaining / 60000)} min session`;
  }

  byId('login-tab').addEventListener('click', () => authMode(false));
  byId('register-tab').addEventListener('click', () => authMode(true));
  byId('auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    byId('auth-submit').disabled = true;
    try {
      const result = await api(`/api/auth/${registering ? 'register' : 'login'}`, { email: byId('email').value, password: byId('password').value, full_name: byId('full-name').value, consent: byId('consent').checked });
      if (registering) { authMode(false); flash(result.message, true); }
      else signedIn();
    } catch (error) { flash(error.message); }
    finally { byId('auth-submit').disabled = false; }
  });
  for (const role of ['patient', 'admin']) byId(`demo-${role}`).addEventListener('click', async () => {
    byId(`demo-${role}`).disabled = true;
    try { await api(`/api/auth/demo/${role}`, {}); if (role === 'admin') location.assign('/bot-metrics-dashboard.html'); else signedIn(); }
    catch (error) { flash(error.message); }
    finally { byId(`demo-${role}`).disabled = false; }
  });
  byId('logout').addEventListener('click', async () => { try { await api('/api/auth/logout', {}); signedOut(); } catch (error) { flash(error.message); } });
  byId('chat-form').addEventListener('submit', event => { event.preventDefault(); send(byId('message-input').value); });
  byId('message-input').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (byId('chat-form').reportValidity()) send(byId('message-input').value); } });
  byId('topics').addEventListener('click', event => { const button = event.target.closest('button[data-action]'); if (button) send(button.textContent.trim(), button.dataset.action); });
  window.addEventListener('patient-action', event => send(event.detail.message, event.detail.action));
  window.addEventListener('chat-mode-changed', async () => {
    const userId = state.user?.id;
    const beta = window.DiagnoBeta.enabled();
    byId('messages').replaceChildren();
    byId('message-input').placeholder = beta ? 'Ask a question or continue the conversation...' : 'Ask about reports, centres or prices...';
    try {
      if (beta) {
        const result = await api('/api/beta/history');
        if (state.user?.id !== userId || !window.DiagnoBeta.enabled()) return;
        for (const turn of result.turns) message(turn.role === 'patient' ? 'user' : 'assistant', turn.text);
        if (!result.turns.length) message('assistant', 'Hello. What can I help you with today?');
      } else message('assistant', 'What would you like to ask about today?');
    } catch (error) { flash(error.message); }
  });
  byId('keep-session').addEventListener('click', async () => { try { await api('/api/auth/session', {}); sessionClock(); } catch (error) { flash(error.message); } });
  byId('support-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!ticket) return;
    const button = byId('support-form').querySelector('button');
    button.disabled = true;
    try { await api(`/api/escalations/${ticket.id}/messages`, { message: byId('support-input').value }); byId('support-input').value = ''; await pollSupport(); }
    catch (error) { flash(error.message); }
    finally { button.disabled = false; }
  });
  byId('support-expand').addEventListener('click', () => {
    const panel = byId('support-panel');
    if (panel.classList.contains('support-expanded')) {
      panel.classList.remove('support-expanded');
      panel.classList.add('support-collapsed');
      byId('support-expand').title = 'Expand support panel';
      byId('support-expand').setAttribute('aria-label', 'Expand support panel');
      byId('support-expand').querySelector('i').dataset.lucide = 'maximize-2';
    } else {
      panel.classList.remove('support-collapsed');
      panel.classList.add('support-expanded');
      byId('support-expand').title = 'Collapse support panel';
      byId('support-expand').setAttribute('aria-label', 'Collapse support panel');
      byId('support-expand').querySelector('i').dataset.lucide = 'minimize-2';
    }
    icons();
  });
  byId('support-close').addEventListener('click', async () => {
    if (!ticket) return;
    const closeBtn = byId('support-close');
    closeBtn.disabled = true;
    try {
      await api(`/api/escalations/${ticket.id}/close`, {});
      ticket = null;
      byId('support-panel').hidden = true;
      byId('support-panel').classList.add('support-closed');
      flash('Support request closed.', true);
      setTimeout(() => {
        byId('flash').hidden = true;
      }, 5000);
      closeBtn.disabled = false;
    } catch (error) {
      flash(error.message);
      closeBtn.disabled = false;
    }
  });
  byId('recover-open').addEventListener('click', () => byId('recover-dialog').showModal());
  byId('recover-close').addEventListener('click', () => byId('recover-dialog').close());
  byId('recover-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = byId('recover-form').querySelector('button');
    button.disabled = true;
    try { byId('recover-result').textContent = (await api('/api/auth/recover', { email: byId('recover-email').value, kind: byId('recover-kind').value })).message; }
    catch (error) { byId('recover-result').textContent = error.message; }
    finally { button.disabled = false; }
  });
  byId('reset-form').addEventListener('submit', async event => {
    event.preventDefault();
    try { const result = await api('/api/auth/reset', { token: resetToken, password: byId('reset-password').value }); resetToken = ''; byId('reset-password').value = ''; byId('reset-form').hidden = true; byId('auth-form').hidden = false; authMode(false); flash(result.message, true); }
    catch (error) { flash(error.message); }
  });
  window.addEventListener('session-expired', () => { signedOut(); flash('Your session ended. Sign in again to continue.'); });
  setInterval(pollSupport, 5000);
  setInterval(sessionClock, 10000);
  async function boot() {
    icons();
    try {
      state.config = await api('/api/config');
      byId('sample-banner').hidden = !state.config.demo;
      byId('demo-access').hidden = !state.config.demo;
      if (/^\+[1-9]\d{7,14}$/.test(state.config.support_phone || '')) { byId('support-phone').textContent = state.config.support_phone; byId('support-phone').href = `tel:${state.config.support_phone}`; byId('support-phone').hidden = false; }
      const fragment = new URLSearchParams(location.hash.slice(1));
      history.replaceState(null, '', location.pathname + location.search);
      if (fragment.has('verify')) { flash((await api('/api/auth/verify', { token: fragment.get('verify') })).message, true); return; }
      if (fragment.has('reset')) { resetToken = fragment.get('reset'); byId('auth-form').hidden = true; byId('reset-form').hidden = false; byId('auth-title').textContent = 'Change password'; return; }
      try { await api('/api/auth/me'); signedIn(); } catch (error) { if (error.status !== 401) throw error; signedOut(); }
      if (location.pathname === '/register') authMode(true);
    } catch (error) { flash(error.message); }
  }
  boot();
})();