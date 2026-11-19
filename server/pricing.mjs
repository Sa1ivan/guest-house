import { createHash, createHmac } from 'node:crypto';

const dayMs = 86_400_000;
const maxNights = 365;
const maxGuests = 6;
const moscowCalendar = new Intl.DateTimeFormat('en', {
  timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
});

export class ApiError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function invalidRequest(message = 'Проверьте данные заявки.') {
  throw new ApiError(422, 'invalid_request', message);
}

export function calendarDay(value) {
  if (typeof value !== 'string' || value.length !== 10 || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(timestamp) && isoDay(timestamp / dayMs) === value ? timestamp / dayMs : null;
}

function isoDay(day) {
  return new Date(day * dayMs).toISOString().slice(0, 10);
}

export function moscowToday(now) {
  const parts = moscowCalendar.formatToParts(now);
  const { year, month, day } = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return [year, month, day].join('-');
}

export function validRoomId(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}(?![\s\S])/.test(value);
}

export function validExtraBeds(value) {
  return Number.isInteger(value) && value >= 0 && value <= maxGuests;
}

export function parseStay(input, today) {
  const { checkIn, checkOut, guests } = input;
  const arrival = calendarDay(checkIn);
  const departure = calendarDay(checkOut);
  if (arrival === null || departure === null || departure <= arrival) {
    invalidRequest('Укажите корректные даты заезда и выезда.');
  }
  if (checkIn < today) invalidRequest('Укажите дату заезда, которая ещё не прошла.');
  const nights = departure - arrival;
  if (nights > maxNights) invalidRequest('Укажите проживание не дольше 365 ночей.');
  if (!Number.isInteger(guests) || guests < 1 || guests > maxGuests) invalidRequest('Укажите от 1 до 6 гостей.');
  return { checkIn, checkOut, guests, arrival, departure, nights };
}

export function createCatalog(rooms, rates, signingSecret) {
  if (!Array.isArray(rooms)) throw new Error('Invalid room catalog.');
  const roomMap = new Map();
  for (const room of rooms) {
    const { id, title, guests, extraBeds, extraBedKind } = room ?? {};
    if (!validRoomId(id) || roomMap.has(id) || typeof title !== 'string' || !title.trim() ||
        /[\p{Cc}\p{Cs}\p{Zl}\p{Zp}]/u.test(title) || [...title].length > 120 ||
        !Number.isInteger(guests) || guests < 1 || !validExtraBeds(extraBeds) ||
        guests + extraBeds > maxGuests || typeof extraBedKind !== 'string') {
      throw new Error('Invalid room catalog.');
    }
    roomMap.set(id, { id, title, guests, extraBeds, extraBedKind });
  }

  if (!rates || typeof rates !== 'object' || Array.isArray(rates)) throw new Error('Invalid room rates.');
  const rateMap = new Map();
  for (const [id, ranges] of Object.entries(rates)) {
    if (!roomMap.has(id) || !Array.isArray(ranges)) throw new Error('Invalid room rates.');
    const rows = ranges.map((range) => {
      const from = calendarDay(range?.from);
      const through = calendarDay(range?.through);
      const nightlyRub = range?.nightlyRub;
      if (from === null || through === null || from > through || !Number.isSafeInteger(nightlyRub) || nightlyRub < 0) {
        throw new Error('Invalid room rate.');
      }
      return { from, through, nightlyRub };
    }).sort((a, b) => a.from - b.from);
    for (let index = 1; index < rows.length; index++) {
      if (rows[index].from <= rows[index - 1].through) throw new Error('Overlapping room rates.');
    }
    rateMap.set(id, rows);
  }

  function quote(id, stay, extraBeds) {
    const room = roomMap.get(id);
    if (!room) return { status: 'unpriced' };
    const neededExtraBeds = Math.max(0, stay.guests - room.guests);
    if (extraBeds < neededExtraBeds || extraBeds > room.extraBeds) return { status: 'capacity', neededExtraBeds };

    const ranges = rateMap.get(id) ?? [];
    const periods = [];
    let rateIndex = 0;
    let baseRub = 0;
    let extrasRub = 0;
    for (let day = stay.arrival; day < stay.departure; day++) {
      while (ranges[rateIndex]?.through < day) rateIndex++;
      const rate = ranges[rateIndex];
      if (!rate || rate.from > day) return { status: 'unpriced' };
      const night = isoDay(day);
      const end = isoDay(day + 1);
      const month = night.slice(5, 7);
      const nightlyBaseRub = rate.nightlyRub;
      const nightlyExtraRub = extraBeds * (month === '07' || month === '08' ? 1000 : 500);
      if (nightlyBaseRub > Number.MAX_SAFE_INTEGER - baseRub - extrasRub - nightlyExtraRub) {
        throw new Error('Room quote exceeds the supported amount.');
      }
      baseRub += nightlyBaseRub;
      extrasRub += nightlyExtraRub;

      const previous = periods.at(-1);
      if (previous?.nightlyBaseRub === nightlyBaseRub && previous.nightlyExtraRub === nightlyExtraRub) {
        previous.end = end;
        previous.nights++;
      } else {
        periods.push({ start: night, end, nights: 1, nightlyBaseRub, nightlyExtraRub });
      }
    }

    const result = { status: 'priced', nights: stay.nights, baseRub, extrasRub, totalRub: baseRub + extrasRub, periods };
    const canonical = [
      'guest-house/quote/v1', room.id, room.title, room.extraBedKind,
      stay.checkIn, stay.checkOut, stay.guests, extraBeds, result,
    ];
    const hash = signingSecret ? createHmac('sha256', signingSecret) : createHash('sha256');
    return { ...result, signature: hash.update(JSON.stringify(canonical)).digest('hex') };
  }

  return { rooms: roomMap, quote };
}
