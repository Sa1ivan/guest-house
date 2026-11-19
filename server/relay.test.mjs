import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { test } from 'node:test';
import { createCatalog, moscowToday, parseStay } from './pricing.mjs';
import { createRelay } from './relay.mjs';

const origin = 'https://guest-house.example';
const consentVersion = '2026-11-19';
const submissionKey = 'f80351aa-8c21-40f3-af38-fcada8d8b9ce';
const fixedNow = new Date('2027-06-29T21:01:00Z');
const rooms = [
  { id: 'birch', title: 'Стандарт с видом на море', guests: 2, extraBeds: 2, extraBedKind: 'раскладушка' },
  { id: 'oak', title: 'Четырёхместный', guests: 4, extraBeds: 0, extraBedKind: '' },
];
const rates = {
  birch: [
    { from: '2027-06-01', through: '2027-07-01', nightlyRub: 3000 },
    { from: '2027-07-02', through: '2027-07-03', nightlyRub: 3500 },
  ],
};
const site = {
  public: true,
  url: origin + '/guest-house/',
  phone: '+7 900 000-00-00',
  email: 'bookings@guest-house.example',
  operator: { name: 'Оператор', address: 'Адрес', registration: '1234567890' },
  registry: { number: '12345', url: 'https://registry.example/12345' },
  dataRecipients: 'Оператор и сервис доставки сообщений',
  dataRetention: 'До обработки заявки',
  consentVersion,
};
const env = {
  SITE_ORIGIN: origin,
  REQUESTS_ENABLED: 'true',
  TELEGRAM_BOT_TOKEN: '123456:example-test-token-only',
  TELEGRAM_CHAT_ID: '-1001234567890',
};
const selection = {
  checkIn: '2027-06-30', checkOut: '2027-07-04', guests: 3, room: 'birch', extraBeds: 1,
};

function booking(signature, changes = {}) {
  return {
    ...selection,
    quoteSignature: signature,
    name: 'Тестовый гость',
    phone: '+7 (900) 123-45-67',
    note: 'Тихий номер.\r\n<b>Просьба связаться вечером</b>',
    consent: true,
    consentVersion,
    submissionKey,
    website: '',
    ...changes,
  };
}

async function startRelay(t, options = {}) {
  const server = createRelay({
    env,
    content: { rooms, rates, site },
    clock: () => fixedNow,
    fetchImpl: () => assert.fail('Telegram should not be contacted'),
    ...options,
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = 'http://127.0.0.1:' + server.address().port;
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return async (path, { method = 'POST', body, headers: additional = {} } = {}) => {
    const headers = { origin, ...additional };
    if (body !== undefined && !Object.hasOwn(headers, 'content-type')) headers['content-type'] = 'application/json';
    const response = await fetch(address + path, {
      method,
      headers: Object.fromEntries(Object.entries(headers).filter(([, value]) => value !== undefined)),
      body: body === undefined || typeof body === 'string' ? body : JSON.stringify(body),
    });
    const payload = response.status === 204 ? null : await response.json();
    return { status: response.status, headers: response.headers, payload, address };
  };
}

async function getQuote(api, body = selection) {
  const response = await api('/api/quote', { body });
  assert.equal(response.status, 200);
  return response.payload.quotes.birch;
}

test('charges every night once and splits the quote when the rate or monthly extra charge changes', () => {
  const catalog = createCatalog(rooms, rates, 'example-test-secret');
  const stay = parseStay(selection, '2027-06-30');
  const quote = catalog.quote('birch', stay, 1);

  assert.deepEqual(quote, {
    status: 'priced',
    nights: 4,
    baseRub: 13000,
    extrasRub: 3500,
    totalRub: 16500,
    periods: [
      { start: '2027-06-30', end: '2027-07-01', nights: 1, nightlyBaseRub: 3000, nightlyExtraRub: 500 },
      { start: '2027-07-01', end: '2027-07-02', nights: 1, nightlyBaseRub: 3000, nightlyExtraRub: 1000 },
      { start: '2027-07-02', end: '2027-07-04', nights: 2, nightlyBaseRub: 3500, nightlyExtraRub: 1000 },
    ],
    signature: quote.signature,
  });
  assert.match(quote.signature, /^[a-f0-9]{64}$/);
  assert.notEqual(quote.signature, catalog.quote('birch', { ...stay, guests: 2 }, 1).signature);
  assert.equal(quote.signature, catalog.quote('birch', stay, 1).signature);
});

test('September falls back to the 500 ₽ per bed rate', () => {
  const catalog = createCatalog(rooms, {
    birch: [{ from: '2027-08-31', through: '2027-09-01', nightlyRub: 3000 }],
  });
  const stay = parseStay({ checkIn: '2027-08-31', checkOut: '2027-09-02', guests: 4 }, '2027-06-30');
  assert.equal(catalog.quote('birch', stay, 2).extrasRub, 3000);
});

test('validates capacity and treats any night without a tariff as unpriced', () => {
  const catalog = createCatalog(rooms, rates);
  const stay = parseStay(selection, '2027-06-30');
  assert.deepEqual(catalog.quote('birch', stay, 0), { status: 'capacity', neededExtraBeds: 1 });
  assert.deepEqual(catalog.quote('birch', stay, 3), { status: 'capacity', neededExtraBeds: 1 });
  assert.deepEqual(catalog.quote('oak', stay, 0), { status: 'unpriced' });
  assert.deepEqual(catalog.quote('birch', parseStay({ ...selection, checkOut: '2027-07-05' }, '2027-06-30'), 1), {
    status: 'unpriced',
  });
  assert.throws(() => createCatalog(rooms, {
    birch: [{ from: '2027-06-20', through: '2027-07-02', nightlyRub: 999 }, ...rates.birch],
  }), /overlap/i);
});

test('uses the Moscow calendar day and validates dates, guest limits and the 365-night cap', () => {
  assert.equal(moscowToday(new Date('2027-06-29T20:59:59Z')), '2027-06-29');
  assert.equal(moscowToday(fixedNow), '2027-06-30');
  assert.equal(parseStay(selection, '2027-06-30').nights, 4);
  assert.equal(parseStay({ ...selection, checkOut: '2028-06-29' }, '2027-06-30').nights, 365);
  for (const invalid of [
    { checkIn: '2027-06-29' },
    { checkIn: '2027-6-30' },
    { checkOut: '2027-02-29' },
    { checkOut: '2027-06-30' },
    { checkOut: '2028-06-30' },
    { guests: 0 },
    { guests: 7 },
    { guests: '3' },
  ]) {
    assert.throws(() => parseStay({ ...selection, ...invalid }, '2027-06-30'), { code: 'invalid_request' });
  }
});

test('returns quotes for all rooms with zero extras when no category is requested', async (t) => {
  const api = await startRelay(t);
  const { checkIn, checkOut, guests } = selection;
  const response = await api('/api/quote', { body: { checkIn, checkOut, guests, extraBeds: 2 } });
  assert.equal(response.status, 200);
  assert.deepEqual(response.payload, {
    quotes: { birch: { status: 'capacity', neededExtraBeds: 1 }, oak: { status: 'unpriced' } },
    acceptingRequests: true,
  });
});

test('serves disabled loopback quotes without an origin or bot credentials', async (t) => {
  const api = await startRelay(t, { env: {}, content: { rooms, rates: {}, site: { ...site, public: false } } });
  const quote = await api('/api/quote', { body: selection, headers: { origin: undefined } });
  assert.equal(quote.status, 200);
  assert.deepEqual(quote.payload, { quotes: { birch: { status: 'unpriced' } }, acceptingRequests: false });
  const localOrigin = 'http://localhost:8080';
  const loopback = await api('/api/quote', { body: selection, headers: { origin: localOrigin } });
  assert.equal(loopback.status, 200);
  assert.equal(loopback.headers.get('access-control-allow-origin'), localOrigin);
  const submission = await api('/api/request', { body: booking('1'.repeat(64)), headers: { origin: undefined } });
  assert.equal(submission.status, 503);
  assert.equal(submission.payload.error, 'requests_unavailable');
});

test('keeps requests disabled until the intake switch, valid origin, bot and site disclosures are complete', async (t) => {
  for (const prerequisites of [
    { env: { ...env, REQUESTS_ENABLED: undefined } },
    { env: { ...env, SITE_ORIGIN: undefined } },
    { env: { ...env, SITE_ORIGIN: 'https://127.0.0.1' } },
    { env: { ...env, TELEGRAM_BOT_TOKEN: '' } },
    { env: { ...env, TELEGRAM_CHAT_ID: '@example' } },
    { content: { rooms, rates, site: { ...site, public: false } } },
    { content: { rooms, rates, site: { ...site, url: 'http://guest-house.example' } } },
    { content: { rooms, rates, site: { ...site, registry: { number: '', url: '' } } } },
    { content: { rooms, rates, site: { ...site, phone: '' } } },
    { content: { rooms, rates, site: { ...site, dataRetention: '' } } },
  ]) {
    const api = await startRelay(t, prerequisites);
    const headers = { origin: prerequisites.env?.SITE_ORIGIN !== origin && prerequisites.env ? undefined : origin };
    const quote = await api('/api/quote', { body: selection, headers });
    assert.equal(quote.status, 200);
    assert.equal(quote.payload.acceptingRequests, false);
  }
});

test('checks configured browser origins, preflights and method without exposing a request on GET', async (t) => {
  const pagesOrigin = 'https://guest-house.github.io';
  const api = await startRelay(t, { env: { ...env, SITE_ORIGIN: pagesOrigin + '/' } });
  const preflight = await api('/api/request', { method: 'OPTIONS', headers: {
    origin: pagesOrigin,
    'access-control-request-method': 'POST',
    'access-control-request-headers': 'content-type',
  } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), pagesOrigin);
  assert.equal(preflight.headers.get('access-control-allow-headers'), 'Content-Type');
  assert.match(preflight.headers.get('vary'), /Origin/i);

  for (const blocked of [undefined, 'null', 'http://guest-house.github.io', origin, pagesOrigin + '.invalid']) {
    const response = await api('/api/request', {
      body: booking('1'.repeat(64)),
      headers: { origin: blocked },
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  }

  const unsupported = await api('/api/request', { method: 'OPTIONS', headers: {
    origin: pagesOrigin, 'access-control-request-method': 'DELETE',
  } });
  assert.equal(unsupported.status, 403);
  const allowed = await api('/api/quote', { body: selection, headers: { origin: pagesOrigin, host: 'guest-house.github.io' } });
  assert.equal(allowed.status, 200);
  const gets = await api('/api/request', { method: 'GET', headers: { origin: pagesOrigin } });
  assert.equal(gets.status, 405);
  assert.equal(gets.headers.get('allow'), 'POST, OPTIONS');
  assert.equal((await api('/healthz', { method: 'GET' })).status, 200);
});

test('rejects malformed JSON, oversize bodies, missing prices and invalid application fields', async (t) => {
  const api = await startRelay(t);
  const quote = await getQuote(api);
  for (const [body, status, headers] of [
    ['{bad json', 400],
    [{ ...selection, room: ['birch'] }, 422],
    [selection, 415, { 'content-type': 'text/plain' }],
    ['x'.repeat(8300), 413],
  ]) {
    const reply = await api('/api/quote', { body, headers });
    assert.equal(reply.status, status);
  }
  for (const changes of [
    { website: 'spam.example' },
    { website: null },
    { consent: 'true' },
    { consent: false },
    { consentVersion: '2026-11-18' },
    { name: 'Гость\nПодмена' },
    { phone: '123' },
    { note: '🙂'.repeat(501) },
    { note: '\ud800' },
    { submissionKey: 'not-a-uuid' },
    { totalRub: 1 },
  ]) {
    const reply = await api('/api/request', { body: booking(quote.signature, changes) });
    assert.equal(reply.status, 422, JSON.stringify(changes));
  }
  const unpriced = await api('/api/request', { body: booking(quote.signature, { checkOut: '2027-07-05' }) });
  assert.equal(unpriced.status, 409);
  assert.deepEqual(unpriced.payload.quote, { status: 'unpriced' });
});

test('stops reading a chunked body after the size limit and returns 413', async (t) => {
  const api = await startRelay(t);
  const { address } = await api('/healthz', { method: 'GET' });
  const status = await new Promise((resolve, reject) => {
    const outgoing = request(address + '/api/quote', {
      method: 'POST', headers: { origin, 'content-type': 'application/json' },
    }, (incoming) => {
      incoming.resume();
      incoming.on('end', () => resolve(incoming.statusCode));
      incoming.on('error', reject);
    });
    outgoing.on('error', reject);
    outgoing.write('x'.repeat(5000));
    outgoing.end('y'.repeat(5000));
  });
  assert.equal(status, 413);
});

test('returns the recomputed quote after a tariff update without contacting Telegram', async (t) => {
  const first = await startRelay(t);
  const original = await getQuote(first);
  const updated = await startRelay(t, {
    content: { rooms, rates: { birch: rates.birch.map((rate) => ({ ...rate, nightlyRub: rate.nightlyRub + 100 })) }, site },
  });
  const response = await updated('/api/request', { body: booking(original.signature) });
  assert.equal(response.status, 409);
  assert.equal(response.payload.error, 'price_changed');
  assert.equal(response.payload.quote.totalRub, original.totalRub + 400);
  assert.notEqual(response.payload.quote.signature, original.signature);
});

test('waits for confirmed Telegram acceptance and sends the validated total and consent in plain text', async (t) => {
  let sent;
  const api = await startRelay(t, {
    fetchImpl: async (url, options) => {
      sent = { url, options, message: JSON.parse(options.body) };
      return Response.json({
        ok: true,
        result: { message_id: 42, date: 1814302860, chat: { id: -1001234567890, type: 'supergroup' } },
      });
    },
  });
  const quote = await getQuote(api);
  const response = await api('/api/request', { body: booking(quote.signature, { note: 'Тихо\r\n<b>Вечером</b>' }) });
  assert.equal(response.status, 201);
  assert.deepEqual(response.payload, { requestId: submissionKey });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(sent.url, `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`);
  assert.equal(sent.options.method, 'POST');
  assert.equal(sent.options.redirect, 'error');
  assert.equal(sent.message.chat_id, Number(env.TELEGRAM_CHAT_ID));
  assert.equal(sent.message.parse_mode, undefined);
  assert.deepEqual(sent.message.link_preview_options, { is_disabled: true });
  assert.ok(sent.message.text.includes(submissionKey));
  assert.match(sent.message.text, /Стандарт с видом на море/);
  assert.match(sent.message.text, /30\.06\.2027/);
  assert.match(sent.message.text, /04\.07\.2027/);
  assert.match(sent.message.text, /\+7 \(900\) 123-45-67/);
  assert.match(sent.message.text, /Тестовый гость/);
  assert.match(sent.message.text, /Проживание[^\n]+13\s000 ₽/);
  assert.match(sent.message.text, /Допмест[^\n]+3\s500 ₽/);
  assert.match(sent.message.text, /Итого[^\n]+16\s500 ₽/);
  assert.match(sent.message.text, /Тихо\n\s*<b>Вечером<\/b>/);
  assert.match(sent.message.text, /Согласие[^\n]+2026-11-19[^\n]+2027-06-30/);
});

test('makes a single delivery attempt and distinguishes explicit rejection from an unknown outcome', async (t) => {
  for (const [error, deliver] of [
    ['telegram_rejected', () => Response.json({ ok: false, error_code: 400, description: 'Synthetic rejection' }, { status: 400 })],
    ['telegram_rejected', () => Response.json({ ok: false, error_code: 429, description: 'Synthetic throttle' }, { status: 429 })],
    ['delivery_unknown', () => { throw new Error('Synthetic timeout'); }],
    ['delivery_unknown', () => new Response('proxy error', { status: 503 })],
    ['delivery_unknown', () => Response.json({ ok: true })],
    ['delivery_unknown', () => Response.json({ ok: true, result: { message_id: 1 } }, { status: 500 })],
  ]) {
    let calls = 0;
    const api = await startRelay(t, { fetchImpl: () => { calls++; return deliver(); } });
    const quote = await getQuote(api);
    const response = await api('/api/request', { body: booking(quote.signature) });
    assert.equal(response.status, 502);
    assert.equal(response.payload.error, error);
    assert.equal(response.payload.requestId, undefined);
    assert.equal(calls, 1);
    assert.doesNotMatch(response.payload.message, /Synthetic|proxy error|test-token|Гость/i);
  }
});

test('uses short-lived process-wide request counts and allows intake again in the next window', async (t) => {
  let now = fixedNow;
  let calls = 0;
  const api = await startRelay(t, {
    clock: () => now,
    fetchImpl: () => {
      calls++;
      return Response.json({ ok: true, result: { message_id: calls } });
    },
  });
  const quote = await getQuote(api);
  const body = booking(quote.signature);
  for (let index = 0; index < 12; index++) {
    assert.equal((await api('/api/request', { body })).status, 201);
  }
  const rejected = await api('/api/request', { body });
  assert.equal(rejected.status, 429);
  assert.equal(rejected.payload.error, 'rate_limited');
  assert.equal(rejected.headers.get('retry-after'), '60');
  assert.equal(calls, 12);
  now = new Date(now.getTime() + 60000);
  assert.equal((await api('/api/request', { body })).status, 201);
  assert.equal(calls, 13);
});
