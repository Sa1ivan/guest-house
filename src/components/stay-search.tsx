"use client";

import { CalendarDays, Search, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";
import { maxGuests } from "@/lib/catalog";
import { guestLabel } from "@/lib/format";
import { ChoicePicker, DatePicker, shiftDays } from "@/components/pickers";

export type Stay = { checkIn: string; checkOut: string; guests: number };

const emptyStay: Stay = { checkIn: "", checkOut: "", guests: 2 };
const changeEvent = "laury-stay-change";
let currentStay = emptyStay;

const getStay = () => currentStay;
const getInitialStay = () => emptyStay;

function subscribe(onChange: () => void) {
  window.addEventListener(changeEvent, onChange);
  return () => window.removeEventListener(changeEvent, onChange);
}

export function useStay() {
  return useSyncExternalStore(subscribe, getStay, getInitialStay);
}

function saveStay(stay: Stay) {
  currentStay = stay;
  window.dispatchEvent(new Event(changeEvent));
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export function todayInSochi() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow" }).format(new Date());
}

function calendarDay(iso: string) {
  if (!isoDate.test(iso)) return NaN;
  const time = Date.parse(iso + "T00:00:00Z");
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === iso ? time : NaN;
}

export function stayProblem(stay: Stay) {
  const start = calendarDay(stay.checkIn);
  const end = calendarDay(stay.checkOut);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return "Укажите дату заезда и более позднюю дату выезда.";
  }
  if (stay.checkIn < todayInSochi()) return "Выберите сегодняшнюю или будущую дату заезда.";
  if ((end - start) / 86_400_000 > 365) return "За одну заявку можно выбрать до 365 ночей.";
  return "";
}

export const validStay = (stay: Stay) => !stayProblem(stay);

export function StayFields() {
  const stay = useStay();
  return (
    <>
      <DatePicker label="Заезд" icon={CalendarDays} value={stay.checkIn} min={todayInSochi}
        onChange={(checkIn) => saveStay({
          ...stay, checkIn, checkOut: checkIn && stay.checkOut > checkIn ? stay.checkOut : "",
        })} />
      <DatePicker label="Выезд" icon={CalendarDays} value={stay.checkOut}
        min={() => shiftDays(stay.checkIn > todayInSochi() ? stay.checkIn : todayInSochi(), 1)}
        max={() => stay.checkIn >= todayInSochi() ? shiftDays(stay.checkIn, 365) : ""}
        onChange={(checkOut) => saveStay({ ...stay, checkOut })} />
      <div className="guest-field">
        <ChoicePicker label="Гости" icon={UsersRound} value={stay.guests}
          options={Array.from({ length: maxGuests }, (_, index) => ({
            value: index + 1, label: guestLabel(index + 1),
          }))}
          onChange={(guests) => saveStay({ ...stay, guests })} />
      </div>
    </>
  );
}

export function StaySearch({ catalog = false }: { catalog?: boolean }) {
  const stay = useStay();
  const router = useRouter();
  const [validation, setValidation] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validStay(stay)) {
      setValidation(stayProblem(stay));
      return;
    }
    setValidation("");
    if (catalog) {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById("catalog")?.scrollIntoView({
        behavior: reducedMotion ? "instant" : "smooth",
        block: "start",
      });
    } else {
      router.push("/rooms/");
    }
  }

  return (
    <div className="search-wrap">
      <form className="stay-search" aria-label="Подбор номера по датам" noValidate onSubmit={submit}>
        <StayFields />
        <button type="submit" className="button search-button" aria-label={catalog ? "Показать подходящие номера" : undefined}>
          <Search size={19} aria-hidden="true" /> {catalog ? "Показать" : "Найти номер"}
        </button>
      </form>
      {validation && !validStay(stay) && <p className="form-message" role="alert">{validation}</p>}
    </div>
  );
}
