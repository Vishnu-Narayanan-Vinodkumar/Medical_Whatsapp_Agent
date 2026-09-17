(() => {
  const { state, el, icon, icons, flash, api, link } = window.Diagno;
  const byId = id => document.getElementById(id);
  const money = amount => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount / 100);
  const day = value => new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const when = value => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST';
  let beta = false;
  let options = { centres: [], pricing: [] };
  let coordinates = null;
  let slots = [];
  let editing = null;
  let requestId = '';
  let slotVersion = 0;
  let confirmAction = null;
  let locationVersion = 0;

  function fill(select, entries, placeholder) {
    select.replaceChildren();
    if (placeholder) { const option = el('option', placeholder); option.value = ''; select.append(option); }
    for (const [value, text] of entries) { const option = el('option', text); option.value = value; select.append(option); }
  }
  function distance(centre) {
    if (!coordinates || !Number.isFinite(centre.latitude) || !Number.isFinite(centre.longitude)) return Infinity;
    const radians = value => value * Math.PI / 180;
    const deltaLatitude = radians(centre.latitude - coordinates.latitude);
    const deltaLongitude = radians(centre.longitude - coordinates.longitude);
    const arc = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(radians(coordinates.latitude)) * Math.cos(radians(centre.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(Math.max(0, 1 - arc)));
  }
  function sortedCentres(city) {
    return options.centres.filter(centre => !city || centre.city === city).slice().sort((first, second) => distance(first) - distance(second));
  }
  function centreLabel(centre) {
    const kilometres = distance(centre);
    return `${centre.name}${Number.isFinite(kilometres) ? ` (~${kilometres.toFixed(1)} km)` : ''}`;
  }
  async function load() {
    const userId = state.user?.id;
    try {
      const result = await api('/api/booking/options');
      if (state.user?.id !== userId) return;
      options = result;
      const cities = [...new Set(options.centres.map(centre => centre.city).filter(Boolean))].sort().map(city => [city, city]);
      fill(byId('location-city'), cities, 'All cities');
      fill(byId('booking-city'), cities, 'Choose city');
      byId('chat-modes').hidden = !state.config.beta_enabled;
      byId('use-web').disabled = !state.config.web_enabled;
      byId('web-option').title = state.config.web_enabled ? 'Read approved public sources' : 'No approved website sources are configured';
      byId('booking-mode-note').textContent = options.sample ? 'Sample centres and slots only. No real lab appointment is created.' : 'Appointments are managed by this desk. Times are in India Standard Time.';
    } catch (error) { flash(error.message); }
  }
  function reset() {
    beta = false;
    coordinates = null;
    options = { centres: [], pricing: [] };
    slots = [];
    editing = null;
    confirmAction = null;
    slotVersion++;
    locationVersion++;
    byId('guided-mode').setAttribute('aria-pressed', 'true');
    byId('beta-mode').setAttribute('aria-pressed', 'false');
    byId('web-option').hidden = true;
    byId('use-web').checked = false;
    byId('location-status').textContent = 'Location not shared';
    byId('detect-location').disabled = false;
    byId('appointments-list').replaceChildren();
    byId('booking-form').reset();
    for (const id of ['booking-dialog', 'appointments-dialog', 'booking-confirm-dialog']) byId(id).close();
  }
  function mode(value) {
    if (state.responsePending || !state.user || beta === value) return;
    beta = value;
    byId('guided-mode').setAttribute('aria-pressed', String(!beta));
    byId('beta-mode').setAttribute('aria-pressed', String(beta));
    byId('web-option').hidden = !beta;
    window.dispatchEvent(new Event('chat-mode-changed'));
  }
  function times() {
    fill(byId('booking-slot'), slots.filter(slot => day(slot) === byId('booking-date').value).map(slot => [slot, new Date(slot).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })]), 'Choose time');
    byId('booking-error').textContent = slots.length ? '' : 'No configured slots are available for this centre.';
  }
  async function loadSlots() {
    const version = ++slotVersion;
    byId('booking-submit').disabled = true;
    slots = [];
    times();
    byId('booking-error').textContent = 'Loading slots...';
    try {
      const result = await api('/api/booking/slots?centre=' + encodeURIComponent(byId('booking-centre').value));
      if (version !== slotVersion || !state.user) return;
      slots = result.slots;
      if (!slots.some(slot => day(slot) === byId('booking-date').value)) byId('booking-date').value = slots.length ? day(slots[0]) : '';
      times();
    } catch (error) { if (version === slotVersion) byId('booking-error').textContent = error.message; }
    finally { if (version === slotVersion) byId('booking-submit').disabled = !slots.length; }
  }
  function centres(preferred) {
    fill(byId('booking-centre'), sortedCentres(byId('booking-city').value).map(centre => [centre.id, centreLabel(centre)]), 'Choose centre');
    byId('booking-centre').value = preferred || sortedCentres(byId('booking-city').value)[0]?.id || '';
    return loadSlots();
  }
  function price() {
    const product = options.pricing.find(item => item.id === byId('booking-product').value);
    byId('booking-price').textContent = money(editing ? editing.amount : (product?.price || 0) * 100);
  }
  async function showBooking(booking = null) {
    if (!state.user) return;
    editing = booking;
    requestId = crypto.randomUUID();
    byId('booking-form').reset();
    byId('booking-title').textContent = booking ? 'Change location or time' : 'Book appointment';
    byId('booking-submit').querySelector('span').textContent = booking ? 'Confirm change' : 'Reserve slot';
    fill(byId('booking-product'), options.pricing.map(product => [product.id, product.name]));
    if (booking) byId('booking-product').value = booking.product_id;
    byId('booking-product').disabled = Boolean(booking);
    byId('booking-city').value = booking ? options.centres.find(centre => centre.id === booking.centre_id)?.city || '' : byId('location-city').value || options.centres[0]?.city || '';
    byId('booking-date').min = day(Date.now());
    byId('booking-date').max = day(Date.now() + 30 * 86400000);
    byId('booking-date').value = booking ? day(booking.starts_at) : day(Date.now());
    price();
    byId('appointments-dialog').close();
    byId('booking-dialog').showModal();
    await centres(booking?.centre_id);
  }
  function confirm(title, details, buttonText, action) {
    confirmAction = action;
    byId('booking-confirm-title').textContent = title;
    byId('booking-confirm-details').textContent = details;
    byId('booking-confirm-submit').querySelector('span').textContent = buttonText;
    byId('booking-confirm-error').textContent = '';
    byId('booking-confirm-dialog').showModal();
  }
  async function pay(booking) {
    const demo = booking.payment_mode === 'demo';
    confirm(demo ? 'Simulate payment' : 'Continue to Stripe', `${booking.product_name} | ${booking.centre_name} | ${money(booking.amount)}. ${demo ? 'Sample simulation only. No money will move.' : booking.payment_mode === 'stripe_test' ? 'Stripe test mode. Do not enter a real card.' : 'Payment details are entered only on Stripe. This payment uses real money.'}`, demo ? 'Simulate payment' : 'Open checkout', async () => {
      const result = await api(`/api/bookings/${booking.id}/pay`, { consent: true, simulate: demo });
      if (!state.user) return;
      if (result.checkout_url) {
        const url = new URL(result.checkout_url);
        if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Unexpected checkout address.');
        location.assign(url.href);
      } else { byId('booking-confirm-dialog').close(); await showAppointments(); }
    });
  }
  function command(text, iconName, action) {
    const button = el('button', text, 'secondary');
    button.prepend(icon(iconName));
    button.addEventListener('click', async () => {
      button.disabled = true;
      try { await action(); } catch (error) { byId('appointments-note').textContent = error.message; }
      finally { button.disabled = false; }
    });
    return button;
  }
  async function showAppointments(refresh = false) {
    const userId = state.user?.id;
    if (!userId) return;
    byId('appointments-dialog').showModal();
    byId('appointments-note').textContent = 'Loading appointments...';
    byId('appointments-refresh').disabled = true;
    try {
      let result = await api('/api/bookings');
      if (refresh) {
        for (const booking of result.bookings.filter(item => item.status === 'pending' && item.checkout_started)) await api(`/api/bookings/${booking.id}/refresh`, {});
        result = await api('/api/bookings');
      }
      if (state.user?.id !== userId) return;
      const rows = result.bookings.map(booking => {
        const row = el('article', undefined, 'appointment-row');
        const header = el('div', undefined, 'section-heading');
        header.append(el('h3', booking.product_name), el('span', `${booking.status} | ${booking.payment_status}`, 'status-tag'));
        row.append(header, el('p', `${booking.centre_name} | ${when(booking.starts_at)}`), el('p', `${money(booking.amount)} | ${booking.payment_mode.replaceAll('_', ' ')} | ${booking.id.slice(0, 8)}`, 'muted'));
        const actions = el('div', undefined, 'appointment-actions');
        if (booking.status === 'pending' && booking.payment_mode !== 'disabled') actions.append(command(booking.payment_mode === 'demo' ? 'Sample payment' : 'Pay', 'credit-card', () => pay(booking)));
        if (['pending', 'confirmed'].includes(booking.status)) {
          if (!(booking.status === 'pending' && booking.checkout_started)) actions.append(command('Change location / time', 'calendar-cog', () => showBooking(booking)));
          if (booking.payment_status !== 'paid') actions.append(command('Cancel', 'calendar-x', () => confirm('Cancel reservation?', `${booking.product_name} at ${booking.centre_name}, ${when(booking.starts_at)}.`, 'Cancel reservation', async () => { await api(`/api/bookings/${booking.id}/cancel`, { consent: true }); byId('booking-confirm-dialog').close(); await showAppointments(); })));
          else actions.append(command('Cancellation support', 'headset', () => { byId('appointments-dialog').close(); window.dispatchEvent(new CustomEvent('patient-action', { detail: { message: 'I need help cancelling a paid booking', action: 'escalation' } })); }));
        }
        row.append(actions);
        return row;
      });
      byId('appointments-list').replaceChildren(...rows);
      byId('appointments-note').textContent = rows.length ? 'Pending reservations are not confirmed appointments.' : 'No appointments yet.';
      icons();
    } catch (error) { byId('appointments-note').textContent = error.message; }
    finally { byId('appointments-refresh').disabled = false; }
  }
  function render(item, result) {
    if (result.intent === 'beta_conversation') item.querySelector('.message-label').append(' Beta');
    if (result.web_notice) item.append(el('p', result.web_notice, 'muted'));
    if (result.web_unavailable) item.append(el('p', `${result.web_unavailable} approved source(s) could not be read.`, 'muted'));
    for (const [index, source] of (result.sources || []).entries()) {
      const anchor = link(`[${index + 1}] ${source.title}`, source.url, 'external-link');
      if (anchor) item.append(anchor);
    }
    if (result.suggested_action === 'book') item.append(command('Choose appointment', 'calendar-plus', () => showBooking()));
    if (result.suggested_action === 'reports') item.append(command('Check reports securely', 'file-check-2', () => window.dispatchEvent(new CustomEvent('patient-action', { detail: { message: 'Check reports', action: 'report_status' } }))));
  }

  byId('guided-mode').addEventListener('click', () => mode(false));
  byId('beta-mode').addEventListener('click', () => mode(true));
  byId('location-city').addEventListener('change', () => { coordinates = null; locationVersion++; byId('detect-location').disabled = false; byId('location-status').textContent = byId('location-city').value ? 'City selected manually' : 'Location not shared'; });
  byId('detect-location').addEventListener('click', () => {
    if (!navigator.geolocation) { byId('location-status').textContent = 'Location is unavailable. Choose a city.'; return; }
    const version = ++locationVersion;
    byId('detect-location').disabled = true;
    byId('location-status').textContent = 'Waiting for location permission...';
    navigator.geolocation.getCurrentPosition(position => {
      if (version !== locationVersion || !state.user) return;
      coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      const closest = sortedCentres('')[0];
      if (closest && Number.isFinite(distance(closest))) { byId('location-city').value = closest.city || ''; byId('location-status').textContent = `Nearest ${options.sample ? 'sample' : 'listed'}: ${centreLabel(closest)}`; }
      else byId('location-status').textContent = 'No centres with coordinates are configured. Choose a city.';
      byId('detect-location').disabled = false;
    }, error => {
      if (version !== locationVersion) return;
      byId('location-status').textContent = error.code === 1 ? 'Location permission declined. Choose a city.' : 'Location unavailable. Choose a city.';
      byId('detect-location').disabled = false;
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  });
  byId('book-open').addEventListener('click', () => showBooking());
  byId('appointments-open').addEventListener('click', () => showAppointments(true));
  byId('appointments-refresh').addEventListener('click', () => showAppointments(true));
  for (const [button, dialog] of [['booking-close', 'booking-dialog'], ['appointments-close', 'appointments-dialog'], ['booking-confirm-close', 'booking-confirm-dialog']]) byId(button).addEventListener('click', () => byId(dialog).close());
  byId('booking-city').addEventListener('change', () => centres());
  byId('booking-centre').addEventListener('change', loadSlots);
  byId('booking-date').addEventListener('change', times);
  byId('booking-product').addEventListener('change', price);
  byId('booking-form').addEventListener('submit', async event => {
    event.preventDefault();
    byId('booking-submit').disabled = true;
    try {
      await api(editing ? `/api/bookings/${editing.id}/reschedule` : '/api/bookings', { request_id: requestId, centre_id: byId('booking-centre').value, product_id: byId('booking-product').value, starts_at: byId('booking-slot').value, consent: byId('booking-consent').checked });
      byId('location-city').value = byId('booking-city').value;
      coordinates = null;
      byId('location-status').textContent = 'Booking city selected';
      byId('booking-dialog').close();
      await showAppointments();
    } catch (error) { byId('booking-error').textContent = error.message; }
    finally { byId('booking-submit').disabled = false; }
  });
  byId('booking-confirm-submit').addEventListener('click', async () => {
    byId('booking-confirm-submit').disabled = true;
    try { if (confirmAction) await confirmAction(); }
    catch (error) { byId('booking-confirm-error').textContent = error.message; }
    finally { byId('booking-confirm-submit').disabled = false; }
  });
  window.addEventListener('patient-signed-in', async () => {
    await load();
    const checkout = new URLSearchParams(location.search).get('checkout');
    if (checkout && state.user) { history.replaceState(null, '', location.pathname); await showAppointments(true); }
  });
  window.addEventListener('patient-signed-out', reset);
  window.DiagnoBeta = { enabled: () => beta, city: () => byId('location-city').value, useWeb: () => byId('use-web').checked, render, showBooking };
})();