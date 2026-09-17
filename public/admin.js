(() => {
  const { state, el, icons, flash, api, label, date } = window.Diagno;
  const byId = id => document.getElementById(id);
  let selectedTicket = null;
  let detailSnapshot = '';
  let updating = false;

  function accessDenied() {
    byId('dashboard-main').hidden = true;
    byId('access-panel').hidden = false;
    byId('logout').hidden = !state.user;
    byId('ticket-dialog').close();
    byId('ticket-context').replaceChildren();
    byId('reply-input').value = '';
    selectedTicket = null;
  }
  async function ticketDetails() {
    if (!selectedTicket) return;
    const selected = selectedTicket;
    const detail = await api(`/admin/queue/${selected}`);
    if (selected !== selectedTicket || !state.user) return;
    const snapshot = JSON.stringify(detail);
    if (detailSnapshot === snapshot) return;
    detailSnapshot = snapshot;
    byId('ticket-title').textContent = label(detail.ticket.reason);
    const nodes = [];
    for (const turn of detail.context) nodes.push(el('p', `${turn.role === 'patient' ? 'Patient' : 'DiagnoBot'}: ${turn.text}`));
    for (const entry of detail.messages) nodes.push(el('p', `${entry.author === 'agent' ? 'Operator' : 'Patient'}: ${entry.content}`));
    if (!nodes.length) nodes.push(el('p', 'No recent conversation content.'));
    byId('ticket-context').replaceChildren(...nodes);
    byId('reply-form').hidden = detail.ticket.status === 'resolved';
  }
  async function openTicket(ticket, button) {
    button.disabled = true;
    try {
      await api(`/admin/queue/${ticket.id}`, { action: 'claim' });
      selectedTicket = ticket.id;
      detailSnapshot = '';
      byId('ticket-error').textContent = '';
      byId('reply-input').value = '';
      await ticketDetails();
      byId('ticket-dialog').showModal();
    } catch (error) { flash(error.message); }
    finally { button.disabled = false; }
  }
  async function update() {
    if (updating || state.user?.role !== 'admin' || document.hidden) return;
    updating = true;
    byId('refresh').disabled = true;
    try {
      const [metrics, queueResult, audit, appointments] = await Promise.all([api('/admin/metrics'), api('/admin/queue'), api('/admin/audit?limit=20'), api('/admin/bookings')]);
      if (!state.user) return;
      for (const [id, value] of Object.entries({ totalRequests: metrics.total_requests, activeSessions: metrics.active_sessions, queueCount: queueResult.queue.length, avgLatency: (metrics.avg_ms / 1000).toFixed(2), p95Latency: (metrics.p95_ms / 1000).toFixed(2), errorCount: metrics.errors })) byId(id).textContent = value;
      byId('lastUpdate').textContent = `Updated ${new Date(metrics.timestamp).toLocaleTimeString()}`;
      byId('auditCount').textContent = `${metrics.audit_count} retained events`;
      byId('groq-stats').textContent = `Groq: ${metrics.groq_calls} calls today | Average ${metrics.groq_avg_ms} ms`;
      byId('health-stats').textContent = `${metrics.successes} turns without service errors | ${metrics.timeouts} LIS timeouts`;
      const bars = Object.entries(metrics.intents).map(([intent, count]) => {
        const row = el('div', undefined, 'bar-row');
        const progress = el('progress');
        progress.max = metrics.total_requests || 1;
        progress.value = count;
        progress.setAttribute('aria-label', label(intent));
        row.append(el('span', label(intent)), progress, el('strong', count));
        return row;
      });
      byId('intentChart').replaceChildren(...(bars.length ? bars : [el('div', 'No conversation activity today.', 'no-data')]));
      const queue = queueResult.queue.map(ticket => {
        const button = el('button', undefined, 'queue-row');
        const info = el('div');
        info.append(el('strong', label(ticket.reason)), el('span', `Request ${ticket.id.slice(0, 8)} | ${Math.max(0, Math.floor((Date.now() - new Date(ticket.created_at).getTime()) / 60000))} min`));
        button.append(info, el('span', ticket.assigned_to === state.user.id ? 'Open' : ticket.status === 'waiting' ? 'Claim' : 'Assigned', 'status-tag'));
        button.disabled = ticket.status === 'assigned' && ticket.assigned_to !== state.user.id;
        button.addEventListener('click', () => openTicket(ticket, button));
        return button;
      });
      byId('queue').replaceChildren(...(queue.length ? queue : [el('div', 'No open support requests.', 'no-data')]));
      const logs = audit.logs.map(log => {
        const row = el('div', undefined, 'log-entry');
        row.append(el('span', date(log.created_at), 'log-time'), el('strong', label(log.action)), el('span', label(log.intent)), el('span', log.success ? 'Recorded' : 'Failed', `status-tag ${log.success ? '' : 'error'}`));
        return row;
      });
      byId('auditLogContainer').replaceChildren(...(logs.length ? logs : [el('div', 'No audit events yet.', 'no-data')]));
      const bookings = appointments.bookings.map(booking => {
        const row = el('article', undefined, 'appointment-row');
        const heading = el('div', undefined, 'section-heading');
        heading.append(el('h3', `${booking.product_name} | ${booking.centre_name}`), el('span', `${booking.status} | ${booking.payment_status}`, 'status-tag'));
        const amount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: booking.currency }).format(booking.amount / 100);
        row.append(heading, el('p', `${date(booking.starts_at)} | ${amount} | ${label(booking.payment_mode)} | ${booking.id}`, 'muted'));
        return row;
      });
      byId('booking-statuses').replaceChildren(...(bookings.length ? bookings : [el('div', 'No appointments yet.', 'no-data')]));
      if (byId('ticket-dialog').open) await ticketDetails();
    } catch (error) { byId('lastUpdate').textContent = 'Update unavailable'; flash(error.message); }
    finally { updating = false; byId('refresh').disabled = false; }
  }
  byId('refresh').addEventListener('click', () => { flash(''); update(); });
  byId('logout').addEventListener('click', async () => { try { await api('/api/auth/logout', {}); location.assign('/'); } catch (error) { flash(error.message); } });
  byId('ticket-close').addEventListener('click', () => byId('ticket-dialog').close());
  byId('ticket-dialog').addEventListener('close', () => { selectedTicket = null; byId('reply-input').value = ''; byId('ticket-context').replaceChildren(); });
  byId('reply-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!selectedTicket) return;
    byId('reply-send').disabled = true;
    try { await api(`/admin/queue/${selectedTicket}`, { action: 'reply', message: byId('reply-input').value }); byId('reply-input').value = ''; await ticketDetails(); }
    catch (error) { byId('ticket-error').textContent = error.message; }
    finally { byId('reply-send').disabled = false; }
  });
  byId('resolve-ticket').addEventListener('click', async () => {
    if (!selectedTicket) return;
    byId('resolve-ticket').disabled = true;
    try { await api(`/admin/queue/${selectedTicket}`, { action: 'resolve' }); byId('ticket-dialog').close(); await update(); }
    catch (error) { byId('ticket-error').textContent = error.message; }
    finally { byId('resolve-ticket').disabled = false; }
  });
  byId('keep-session').addEventListener('click', async () => { try { await api('/api/auth/session', {}); byId('session-warning').hidden = true; } catch (error) { flash(error.message); } });
  window.addEventListener('session-expired', () => { accessDenied(); flash('Your session ended. Sign in again to continue.'); });
  setInterval(update, 5000);
  setInterval(() => {
    if (!state.user) return;
    const remaining = state.expires - Date.now();
    byId('session-warning').hidden = remaining > 300000;
    if (remaining <= 0) { state.user = null; accessDenied(); flash('Your session expired. Please sign in again.'); }
  }, 10000);
  async function boot() {
    icons();
    try {
      state.config = await api('/api/config');
      byId('sample-banner').hidden = !state.config.demo;
      await api('/api/auth/me');
      if (state.user.role !== 'admin') { accessDenied(); return; }
      byId('account-name').textContent = state.user.full_name;
      byId('logout').hidden = false;
      byId('dashboard-main').hidden = false;
      await update();
    } catch (error) { accessDenied(); if (error.status !== 401) flash(error.message); }
  }
  boot();
})();