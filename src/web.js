const dns = require('node:dns/promises');
const { Agent, request } = require('undici');
const ipaddr = require('ipaddr.js');
const cheerio = require('cheerio');
const robotsParser = require('robots-parser');

async function publicAddress(value, lookup = dns.lookup) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || (url.port && url.port !== '443') || ipaddr.isValid(url.hostname.replace(/^\[|\]$/g, ''))) throw new Error('Source must use a public HTTPS hostname.');
  const records = await lookup(url.hostname, { all: true, verbatim: true });
  if (!records.length || records.some(record => !ipaddr.isValid(record.address) || ipaddr.process(record.address).range() !== 'unicast')) throw new Error('Private or reserved network sources are blocked.');
  return { url, records };
}

async function readPublicPage(value) {
  const { url, records } = await publicAddress(value);
  const dispatcher = new Agent({ connect: { lookup(hostname, options, callback) {
    if (hostname !== url.hostname) return callback(new Error('Unexpected source host.'));
    const available = options.family ? records.filter(record => record.family === options.family) : records;
    if (!available.length) return callback(new Error('Source address unavailable.'));
    if (options.all) callback(null, available);
    else callback(null, available[0].address, available[0].family);
  } } });
  try {
    const response = await request(url, { dispatcher, maxRedirections: 0, signal: AbortSignal.timeout(6000), headersTimeout: 5000, bodyTimeout: 5000,
      headers: { 'User-Agent': 'DiagnoBotBeta/1.0', Accept: 'text/html,text/plain;q=0.9', 'Accept-Encoding': 'identity' } });
    if (![200, 404].includes(response.statusCode) || Number(response.headers['content-length']) > 131072) {
      response.body.destroy();
      throw new Error('Source unavailable or too large.');
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 131072) { response.body.destroy(); throw new Error('Source is too large.'); }
      chunks.push(chunk);
    }
    return { status: response.statusCode, type: response.headers['content-type'] || '', text: Buffer.concat(chunks).toString('utf8') };
  } finally { await dispatcher.close(); }
}

function createWebReader({ urls = [], requestImpl = readPublicPage } = {}) {
  const sources = [...new Set(urls)].slice(0, 3);
  const cache = new Map();
  async function read(url) {
    const cached = cache.get(url);
    if (cached && cached.expires > Date.now()) return cached.promise;
    const promise = (async () => {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Invalid source.');
      const robotsUrl = new URL('/robots.txt', parsed).href;
      const robots = await requestImpl(robotsUrl);
      if (robots.status !== 404 && (robots.status !== 200 || !robotsParser(robotsUrl, robots.text).isAllowed(parsed.href, 'DiagnoBotBeta'))) throw new Error('Source does not permit retrieval.');
      const page = await requestImpl(parsed.href);
      if (page.status !== 200 || !/text\/html|application\/xhtml\+xml/i.test(page.type)) throw new Error('Source is not an HTML page.');
      const document = cheerio.load(page.text);
      const title = document('head > title').first().text().replace(/\s+/g, ' ').trim().slice(0, 160) || parsed.hostname;
      document('script,style,noscript,iframe,form,nav,footer,header,svg,[hidden]').remove();
      const main = document('main,article').first();
      const text = (main.length ? main : document('body')).text().replace(/\s+/g, ' ').trim().slice(0, 4000);
      if (!text) throw new Error('Source has no readable text.');
      return { url: parsed.href, title, text, retrieved_at: new Date().toISOString() };
    })();
    cache.set(url, { promise, expires: Date.now() + 600000 });
    return promise;
  }
  return async () => {
    const results = await Promise.allSettled(sources.map(read));
    return { sources: results.filter(result => result.status === 'fulfilled').map(result => result.value), unavailable: results.filter(result => result.status === 'rejected').length };
  };
}

module.exports = { createWebReader, publicAddress };