"use client";

import Link from "next/link";
import { BedDouble, Check, ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { StayFields, stayProblem, useStay, validStay } from "@/components/stay-search";
import { useQuote } from "@/components/quote";
import type { Quote, QuoteResponse } from "@/components/quote";
import { ChoicePicker } from "@/components/pickers";
import { bedLabel, dayLabel, money, nightLabel } from "@/lib/format";
import { bookingEndpoint, config, consentVersion, telephoneHref } from "@/lib/site";

type Props = { id: string; extraBeds: number; extraBedKind: string; hasPublishedRates: boolean; includedGuests: number };
type RequestReply = { requestId?: string; error?: string; message?: string; quote?: Quote };

const emptyDraft = { name: "", phone: "", note: "", consent: false };

export function RoomBooking({ id, extraBeds, extraBedKind, hasPublishedRates, includedGuests }: Props) {
  const stay = useStay();
  const datesReady = validStay(stay);
  const [extras, setExtras] = useState(0);
  const [draft, setDraft] = useState(emptyDraft);
  const [override, setOverride] = useState<{ data: QuoteResponse; quote: Quote }>();
  const [sent, setSent] = useState<string>();
  const [message, setMessage] = useState<{ request: string; text: string }>();
  const [sending, setSending] = useState(false);
  const submissionKey = useRef<string | undefined>(undefined);
  const busy = useRef(false);
  const quoteState = useQuote(stay, hasPublishedRates, id, extras);
  const quote = override && override.data === quoteState.data
    ? override.quote
    : quoteState.data?.quotes[id];
  const price = quote?.status === "priced" ? quote : undefined;
  const canRequest = Boolean(price && quoteState.data?.acceptingRequests);
  const needs = stay.guests - includedGuests - extras;

  async function requestStay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!price || !quoteState.data?.acceptingRequests || busy.current) return;
    const fields = new FormData(event.currentTarget);
    const payload = {
      ...stay, room: id, extraBeds: extras, quoteSignature: price.signature,
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      note: draft.note.trim(),
      website: String(fields.get("website") ?? ""),
      consent: draft.consent, consentVersion,
    };
    const request = quoteState.request;
    submissionKey.current ??= crypto.randomUUID();
    busy.current = true;
    setSending(true);
    setMessage(undefined);

    try {
      const response = await fetch(bookingEndpoint("request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, submissionKey: submissionKey.current }),
        cache: "no-store",
        credentials: "omit",
      });
      const result = await response.json() as RequestReply;
      if (response.ok && result.requestId) {
        setDraft(emptyDraft);
        submissionKey.current = undefined;
        setSent(result.requestId);
      } else if (response.status === 409 && result.error === "price_changed" && result.quote) {
        setOverride({ data: quoteState.data, quote: result.quote });
        setMessage({ request, text: "Тариф изменился. Проверьте новый итог перед отправкой." });
      } else {
        setMessage({ request, text: result.message ?? "Заявка не отправилась. Попробуйте ещё раз." });
      }
    } catch {
      setMessage({ request, text: "Подтверждение доставки не получено. Уточните у владельца, дошла ли заявка." });
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  if (sent) {
    return (
      <aside className="booking-panel" aria-label="Заявка отправлена">
        <div className="booking-success" role="status">
          <Check size={23} aria-hidden="true" />
          <div>
            <h2>Заявка отправлена</h2>
            <p>Номер заявки {sent}. Владелец свяжется с вами, чтобы подтвердить наличие.</p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="booking-panel" id="booking" aria-labelledby="booking-title">
      <h2 id="booking-title">Стоимость проживания</h2>
      <fieldset className="booking-inputs" disabled={sending}>
        <legend className="visually-hidden">Даты и число гостей</legend>
        <StayFields />
        <ChoicePicker label="Допместа" icon={BedDouble} value={extras}
          options={[{ value: 0, label: "Без допмест" },
            ...Array.from({ length: extraBeds }, (_, index) => ({
              value: index + 1, label: bedLabel(index + 1),
            }))]}
          onChange={setExtras} />
      </fieldset>
      <p className="field-help">Дополнительное место — {extraBedKind}. За ночь 1 000 ₽ в июле и августе, 500 ₽ в остальные месяцы.</p>

      <div className="quote-status" aria-live="polite">
        {needs > 0 ? (
          <p className="notice">
            {stay.guests > includedGuests + extraBeds
              ? "Для такого числа гостей выберите более вместительный номер."
              : "Для выбранного числа гостей добавьте ещё " + bedLabel(needs) + "."}{" "}
            <Link href="/rooms/">Все номера</Link>
          </p>
        ) : !datesReady ? (
          <p className="muted">{stay.checkIn && stay.checkOut
            ? stayProblem(stay)
            : "Выберите даты, чтобы узнать стоимость за весь срок."}</p>
        ) : quoteState.loading ? (
          <p className="muted">Рассчитываем стоимость…</p>
        ) : quoteState.error ? (
          <p className="notice">{quoteState.error}{" "}
            <Link href="/contacts/">Контакты и проезд</Link>
          </p>
        ) : !price ? (
          <>
            <p className="notice">Стоимость на эти даты пока не опубликована. Выберите другие даты или свяжитесь с гостевым домом.</p>
            <Link className="text-link" href={config.phone ? telephoneHref : "/contacts/"}>
              {config.phone ? "Позвонить" : "Контакты и проезд"}
            </Link>
          </>
        ) : (
          <>
            <dl className="quote-summary">
              <div><dt>Проживание · {nightLabel(price.nights)}</dt><dd>{money(price.baseRub)}</dd></div>
              <div><dt>{extras ? "Допместа · " + bedLabel(extras) : "Допместа"}</dt><dd>{money(price.extrasRub)}</dd></div>
              <div className="quote-total"><dt>Итого за весь срок</dt><dd>{money(price.totalRub)}</dd></div>
            </dl>
            {price.periods.length === 1 && (
              <p className="quote-night">Тариф за номер — {money(price.periods[0].nightlyBaseRub)} за ночь.</p>
            )}
            {price.periods.length > 1 && (
              <details className="quote-periods">
                <summary>Расчёт по периодам <ChevronDown size={16} aria-hidden="true" /></summary>
                {price.periods.map((period) =>
                  <p key={period.start}>{dayLabel(period.start)} · {nightLabel(period.nights)} × {money(period.nightlyBaseRub + period.nightlyExtraRub)}</p>
                )}
              </details>
            )}
          </>
        )}
      </div>
      {message?.request === quoteState.request && <p className="form-message" role="alert">{message.text}</p>}

      {canRequest ? (
        <form className="inquiry" autoComplete="off" onSubmit={requestStay}>
          <label>Ваше имя<input name="name" required minLength={2} maxLength={80}
            value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
          <label>Телефон<input name="phone" type="tel" required maxLength={32}
            value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></label>
          <label>Пожелания к проживанию <span className="muted">(необязательно)</span>
            <textarea name="note" rows={3} maxLength={500} aria-describedby="note-help"
              value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </label>
          <span className="field-help" id="note-help">Например, «Приедем после 21:00». До 500 символов.</span>
          <input name="website" hidden tabIndex={-1} autoComplete="off" />
          <label className="consent-field">
            <input type="checkbox" name="consent" required checked={draft.consent}
              onChange={(e) => setDraft({ ...draft, consent: e.target.checked })} />
            <span>Даю <Link href="/consent/" target="_blank" rel="noreferrer">согласие на обработку данных</Link>.{" "}
              <Link href="/privacy/" target="_blank" rel="noreferrer">Политика обработки данных</Link>.</span>
          </label>
          <button className="button" type="submit" disabled={sending}>
            {sending ? "Отправляем…" : "Отправить заявку"}
          </button>
        </form>
      ) : price && <p className="field-help">Приём заявок откроется после подключения канала связи с владельцем.</p>}
      <p className="booking-note">Наличие номера подтверждает владелец.</p>
    </aside>
  );
}
