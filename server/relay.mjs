import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { ApiError, calendarDay, createCatalog, invalidRequest, moscowToday, parseStay,
  validExtraBeds, validRoomId } from './pricing.mjs';

const maxBodyBytes = 8 * 1024;
const requestWindowMs = 60_000;
const dateFields = ['checkIn', 'checkOut', 'guests'];
const bookingFields = [
  ...dateFields, 'room', 'extraBeds', 'quoteSignature', 'name', 'phone', 'note',
  'consent', 'consentVersion', 'submissionKey',
];
const utf8 = new TextDecoder('utf-8', { fatal: true });
const rubles = new Intl.NumberFormat('ru-RU');

function readContent() {
  const rooms = JSON.parse(readFileSync(new URL('../content/rooms.json', import.meta.url), 'utf8'));
  const rates = JSON.parse(readFileSync(new URL('../content/room-rates.json', import.meta.url), 'utf8'));
  const site = JSON.parse(readFileSync(new URL('../content/site.json', import.meta.url), 'utf8'));
  return { rooms, rates, site };
}

function publicHttpsUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
        !url.hostname.includes('.') || isIP(url.hostname) || /\.(?:localhost|local)\.?$/.test(url.hostname)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function siteOrigin(value) {
  const url = publicHttpsUrl(value);
  return url?.href === url?.origin + '/' ? url.origin : null;
}

function validPhone(value) {
  if (typeof value !== 'string' || !/^\+?[0-9() .\u00a0\u202f-]{1,39}(?![\s\S])/.test(value)) return false;
  const digits = value.replace(/[^0-9]/g, '').length;
  return digits >= 7 && digits <= 15;
}

function publicationIsReady(site) {
  const required = [
    site?.operator?.name, site?.operator?.address, site?.operator?.registration, site?.registry?.number,
    site?.dataRecipients, site?.dataRetention,
  ];
  return site?.public === true && publicHttpsUrl(site.url) !== null &&
    validPhone(site.phone) && typeof site.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+(?![\s\S])/.test(site.email) &&
    publicHttpsUrl(site.registry?.url) !== null && calendarDay(site.consentVersion) !== null &&
    required.every((value) => typeof value === 'string' && value.trim().length > 0);
}

function telegramSettings(env) {
  const token = typeof env.TELEGRAM_BOT_TOKEN === 'string' ? env.TELEGRAM_BOT_TOKEN.trim() : '';
  const rawChatId = typeof env.TELEGRAM_CHAT_ID === 'string' ? env.TELEGRAM_CHAT_ID.trim() : '';
  const chatId = Number(rawChatId);
  if (!/^[1-9]\d{0,15}:[A-Za-z0-9_-]{20,100}$/.test(token) ||
      !/^-?[1-9]\d{0,15}$/.test(rawChatId) || !Number.isSafeInteger(chatId)) {
    return null;
  }
  return { token, chatId };
}

function allowsOrigin(origin, configured) {
  if (configured) return origin === configured;
  if (origin === undefined) return true;
  try {
    const url = new URL(origin);
    return url.origin === origin && ['http:', 'https:'].includes(url.protocol) &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

function requireFields(input, required, optional = []) {
  if (required.some((field) => !Object.hasOwn(input, field)) ||
      Object.keys(input).some((field) => !required.includes(field) && !optional.includes(field))) {
    invalidRequest();
  }
}

async function readJson(request) {
  const contentType = request.headers['content-type'] ?? '';
  if (!/^application\/json(?:\s*;\s*charset\s*=\s*"?utf-8"?)?$/i.test(contentType.trim())) {
    throw new ApiError(415, 'unsupported_content_type', 'Отправьте данные в формате JSON.');
  }
  const tooLarge = () => new ApiError(413, 'body_too_large', 'Размер заявки превышает допустимый.');
  if (Number(request.headers['content-length']) > maxBodyBytes) throw tooLarge();

  const chunks = [];
  let bytes = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > maxBodyBytes) throw tooLarge();
    chunks.push(chunk);
  }

  let input;
  try {
    input = JSON.parse(utf8.decode(Buffer.concat(chunks, bytes)));
  } catch {
    throw new ApiError(400, 'invalid_json', 'Не удалось прочитать данные заявки.');
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalidRequest();
  return input;
}

function json(response, status, value) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(value));
}

function rateLimit(maximum) {
  let count = 0;
  let windowEnds = 0;
  return (now) => {
    if (now >= windowEnds) {
      count = 0;
      windowEnds = now + requestWindowMs;
    }
    if (count >= maximum) return Math.ceil((windowEnds - now) / 1000);
    count++;
    return 0;
  };
}

function quoteResponse(input, today, catalog, acceptingRequests) {
  requireFields(input, dateFields, ['room', 'extraBeds']);
  const stay = parseStay(input, today);
  const extraBeds = Object.hasOwn(input, 'extraBeds') ? input.extraBeds : 0;
  if (!validExtraBeds(extraBeds)) invalidRequest('Укажите корректное количество дополнительных мест.');
  if (Object.hasOwn(input, 'room')) {
    if (!validRoomId(input.room) || !catalog.rooms.has(input.room)) invalidRequest('Выберите категорию номера.');
    return { quotes: { [input.room]: catalog.quote(input.room, stay, extraBeds) }, acceptingRequests };
  }
  const quotes = Object.fromEntries([...catalog.rooms.keys()].map((id) => [id, catalog.quote(id, stay, 0)]));
  return { quotes, acceptingRequests };
}

function parseBooking(input, consentVersion) {
  requireFields(input, bookingFields, ['website']);
  if (Object.hasOwn(input, 'website') && input.website !== '') invalidRequest();
  if (!validRoomId(input.room) || !validExtraBeds(input.extraBeds)) {
    invalidRequest('Выберите категорию номера и количество дополнительных мест.');
  }
  if (typeof input.quoteSignature !== 'string' || !/^[a-f0-9]{64}(?![\s\S])/.test(input.quoteSignature)) {
    invalidRequest('Рассчитайте стоимость перед отправкой заявки.');
  }
  if (input.consent !== true || input.consentVersion !== consentVersion) {
    invalidRequest('Подтвердите актуальное согласие на обработку персональных данных.');
  }
  if (typeof input.submissionKey !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?![\s\S])/i.test(input.submissionKey)) {
    invalidRequest();
  }

  const name = typeof input.name === 'string' ? input.name : '';
  if (!name.trim() || /[\p{Cc}\p{Cs}\p{Zl}\p{Zp}]/u.test(name) || [...name.trim()].length > 100) {
    invalidRequest('Укажите имя длиной до 100 символов.');
  }
  const phone = typeof input.phone === 'string' ? input.phone.replace(/^ +| +$/g, '') : '';
  if (!validPhone(phone)) invalidRequest('Укажите номер телефона с 7–15 цифрами.');
  const note = typeof input.note === 'string' ? input.note.replace(/\r\n?/g, '\n') : null;
  if (note === null || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\p{Cs}\p{Zl}\p{Zp}]/u.test(note) ||
      [...note].length > 500) {
    invalidRequest('Укажите пожелания длиной до 500 символов.');
  }
  return { name: name.trim(), phone, note, requestId: input.submissionKey.toLowerCase() };
}

function telegramText(booking, room, stay, extraBeds, quote, consentVersion, today) {
  const formatDate = (value) => value.split('-').reverse().join('.');
  const money = (value) => rubles.format(value) + ' ₽';
  const extras = extraBeds === 0 ? 'Допместо не требуется · ' + money(0)
    : 'Допместо · ' + extraBeds + ' (' + room.extraBedKind + ') · ' + money(quote.extrasRub);
  return [
    'Заявка № ' + booking.requestId,
    'Категория · ' + room.title,
    'Заезд · ' + formatDate(stay.checkIn),
    'Выезд · ' + formatDate(stay.checkOut),
    'Ночей · ' + quote.nights,
    'Гостей · ' + stay.guests,
    'Имя · ' + booking.name,
    'Телефон · ' + booking.phone,
    'Проживание · ' + money(quote.baseRub),
    extras,
    'Итого · ' + money(quote.totalRub),
    'Согласие · версия ' + consentVersion + ' · получено ' + today,
    'Пожелания гостя',
    booking.note.trim() ? booking.note.replace(/^/gm, '  ') : '—',
  ].join('\n');
}

async function sendTelegram(fetchImpl, { token, chatId }, text) {
  let response;
  let reply;
  try {
    response = await fetchImpl('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, link_preview_options: { is_disabled: true } }),
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
    });
    reply = await response.json();
  } catch {
    // The upstream connection can fail after Telegram receives the message.
  }
  if (response?.ok && reply?.ok === true && Number.isSafeInteger(reply.result?.message_id) &&
      reply.result.message_id > 0) return;
  if (reply?.ok === false) {
    throw new ApiError(502, 'telegram_rejected', 'Telegram отклонил заявку. Свяжитесь с гостевым домом напрямую.');
  }
  throw new ApiError(502, 'delivery_unknown', 'Не удалось подтвердить доставку заявки. Уточните статус у гостевого дома перед повторной отправкой.');
}

export function createRelay({
  env = process.env, content = readContent(), clock = () => new Date(), fetchImpl = fetch,
} = {}) {
  const origin = siteOrigin(env.SITE_ORIGIN);
  const telegram = telegramSettings(env);
  const { rooms, rates, site } = content;
  const acceptingRequests = env.REQUESTS_ENABLED === 'true' && origin !== null && telegram !== null && publicationIsReady(site);
  const catalog = createCatalog(rooms, rates, acceptingRequests ? telegram.token : undefined);
  const quoteLimit = rateLimit(120);
  const intakeLimit = rateLimit(12);

  return createServer({
    maxHeaderSize: 8 * 1024,
    headersTimeout: 10_000,
    requestTimeout: 15_000,
    connectionsCheckingInterval: 5_000,
  }, async (request, response) => {
    try {
      if (request.url === '/healthz' && request.method === 'GET') return json(response, 200, { ok: true });
      const isQuote = request.url === '/api/quote';
      if (!isQuote && request.url !== '/api/request') {
        throw new ApiError(404, 'not_found', 'Страница не найдена.');
      }
      const requestOrigin = request.headers.origin;
      response.setHeader('Vary', 'Origin');
      if (!allowsOrigin(requestOrigin, origin)) throw new ApiError(403, 'origin_rejected', 'Источник запроса не разрешён.');
      if (requestOrigin) response.setHeader('Access-Control-Allow-Origin', requestOrigin);

      if (request.method === 'OPTIONS') {
        const requestedHeaders = request.headers['access-control-request-headers'];
        response.setHeader('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
        if (request.headers['access-control-request-method'] !== 'POST' ||
            (requestedHeaders && requestedHeaders.split(',').some((header) => header.trim().toLowerCase() !== 'content-type'))) {
          throw new ApiError(403, 'preflight_rejected', 'Запрошенные параметры подключения не разрешены.');
        }
        response.writeHead(204, {
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'no-store',
        });
        return response.end();
      }
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST, OPTIONS');
        throw new ApiError(405, 'method_not_allowed', 'Используйте метод POST.');
      }
      if (!isQuote && !acceptingRequests) {
        throw new ApiError(503, 'requests_unavailable', 'Приём заявок через сайт временно недоступен.');
      }
      const retryAfter = (isQuote ? quoteLimit : intakeLimit)(clock().getTime());
      if (retryAfter > 0) {
        response.setHeader('Retry-After', retryAfter);
        throw new ApiError(429, 'rate_limited', 'Слишком много запросов. Попробуйте позже.');
      }

      const input = await readJson(request);
      const today = moscowToday(clock());
      if (isQuote) return json(response, 200, quoteResponse(input, today, catalog, acceptingRequests));

      const booking = parseBooking(input, site.consentVersion);
      const stay = parseStay(input, today);
      const room = catalog.rooms.get(input.room);
      const quote = catalog.quote(input.room, stay, input.extraBeds);
      if (quote.status !== 'priced' || quote.signature !== input.quoteSignature) {
        throw new ApiError(409, 'price_changed', 'Стоимость или условия размещения изменились. Проверьте расчёт.', { quote });
      }
      await sendTelegram(fetchImpl, telegram, telegramText(booking, room, stay, input.extraBeds, quote, site.consentVersion, today));
      return json(response, 201, { requestId: booking.requestId });
    } catch (error) {
      if (response.destroyed || response.headersSent) return;
      if (error instanceof ApiError) {
        if (error.status === 413) response.setHeader('Connection', 'close');
        return json(response, error.status, { error: error.code, message: error.message, ...error.details });
      }
      return json(response, 500, { error: 'server_error', message: 'При обработке запроса произошла ошибка.' });
    }
  });
}

if (import.meta.main) {
  try {
    const port = Number(process.env.PORT ?? '3000');
    if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('Invalid port.');
    const server = createRelay();
    server.on('error', () => {
      console.error('Unable to listen on the relay port. Check PORT.');
      process.exitCode = 1;
    });
    server.listen(port, '0.0.0.0');
  } catch {
    console.error('Unable to start the booking relay. Check PORT and the booking catalog.');
    process.exitCode = 1;
  }
}
