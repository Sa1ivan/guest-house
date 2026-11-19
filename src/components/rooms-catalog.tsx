"use client";

import { useState } from "react";
import type { Room } from "@/lib/catalog";
import { bedLabel, money } from "@/lib/format";
import { useQuote } from "@/components/quote";
import { RoomCard } from "@/components/room-card";
import { useStay, validStay } from "@/components/stay-search";

export function RoomsCatalog({ rooms, hasPublishedRates }: { rooms: Room[]; hasPublishedRates: boolean }) {
  const stay = useStay();
  const datesReady = validStay(stay);
  const [kind, setKind] = useState<Room["kind"] | "all">("all");
  const quote = useQuote(stay, hasPublishedRates);
  const visible = rooms.filter((room) =>
    (kind === "all" || room.kind === kind) && (!datesReady || room.guests + room.extraBeds >= stay.guests),
  );

  function priceLabel(room: Room) {
    if (!datesReady) return undefined;
    const needed = stay.guests - room.guests;
    if (needed > 0) return "Добавьте " + bedLabel(needed);
    const value = quote.data?.quotes[room.id];
    if (value?.status === "priced") return money(value.totalRub) + " за весь срок";
    if (quote.loading) return "Расчёт стоимости…";
    if (quote.error) return "Расчёт пока недоступен";
    return "Цена пока не опубликована";
  }

  return (
    <section id="catalog" aria-label="Каталог номеров">
      <div className="catalog-tools">
        <div className="filters" role="group" aria-label="Категория номера">
          {([["all", "Все номера"], ["standard", "Стандарт"], ["economy", "Эконом"]] as const)
            .map(([value, label]) =>
              <button type="button" key={value} aria-pressed={kind === value} onClick={() => setKind(value)}>
                {label}
              </button>
            )}
        </div>
        <span className="muted" aria-live="polite">Категорий: {visible.length}</span>
      </div>

      {datesReady && !hasPublishedRates &&
        <p className="notice">Стоимость на эти даты пока не опубликована. Номера можно сравнить по вместимости и удобствам.</p>}
      {visible.length
        ? <div className="room-grid">{visible.map((room) =>
            <RoomCard key={room.id} room={room} availability={priceLabel(room)} />
          )}</div>
        : <p className="notice">В этой категории нет номеров на столько гостей. Выберите другую категорию или измените число гостей.</p>}
    </section>
  );
}
