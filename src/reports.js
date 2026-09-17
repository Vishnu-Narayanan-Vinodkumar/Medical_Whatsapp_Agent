const { randomUUID } = require('node:crypto');

function safeDownload(url, expires, hosts, now = Date.now()) {
  try {
    const parsed = new URL(url);
    const expiry = Date.parse(expires);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && hosts.includes(parsed.host) && expiry > now && expiry <= now + 3600000 ? parsed.href : null;
  } catch { return null; }
}

async function queryReports(profile, config, fetchImpl = fetch) {
  if (config.demo) return {
    source: 'sample',
    reports: [
      { id: 'sample-001', name: 'Basic health check', status: 'ready', sample_date: '2026-09-15', report_date: '2026-09-16T09:30:00Z', download_url: null },
      { id: 'sample-002', name: 'Standard blood panel', status: 'processing', sample_date: '2026-09-16', estimated_ready_time: '2026-09-18T12:00:00Z', download_url: null },
    ],
  };
  if (!profile.patient_id) throw new Error('identity_link_required');
  if (!config.lisUrl.startsWith('https://') || !config.lisKey || /your[_-]|placeholder/i.test(config.lisKey)) throw new Error('lis_unavailable');
  try {
    const response = await fetchImpl(`${config.lisUrl.replace(/\/$/, '')}/reports/${encodeURIComponent(profile.patient_id)}`, {
      headers: { Authorization: `Bearer ${config.lisKey}`, 'X-Request-ID': randomUUID(), Accept: 'application/json', ...(profile.dob_hash ? { 'X-Patient-DOB': profile.dob_hash } : {}) },
      signal: AbortSignal.timeout(5000), redirect: 'error',
    });
    if (!response.ok) throw new Error('lis_unavailable');
    const body = await response.json();
    if (!Array.isArray(body.reports) || body.reports.length > 50) throw new Error('lis_unavailable');
    const reports = body.reports.map(report => {
      if (!['ready', 'processing', 'delayed', 'error'].includes(report.status) || typeof report.test_name !== 'string' || report.test_name.length > 200 || typeof report.report_id !== 'string') throw new Error('lis_unavailable');
      const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
      return {
        id: report.report_id.slice(0, 100), name: report.test_name, status: report.status,
        sample_date: date(report.sample_date), report_date: date(report.report_date), estimated_ready_time: date(report.estimated_ready_time),
        download_url: report.status === 'ready' ? safeDownload(report.download_url, report.url_expires_at, config.reportHosts) : null,
        url_expires_at: date(report.url_expires_at),
      };
    });
    return { source: 'lis', reports };
  } catch (error) {
    throw new Error(['TimeoutError', 'AbortError'].includes(error.name) ? 'lis_timeout' : 'lis_unavailable', { cause: error });
  }
}

module.exports = { queryReports, safeDownload };