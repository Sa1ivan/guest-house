"use client";

import { Check, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { ComponentType, KeyboardEvent, ReactNode } from "react";

type Icon = ComponentType<{ size?: number; className?: string; "aria-hidden"?: true }>;
type PickerProps = {
  label: string;
  value: string;
  icon: Icon;
  variant: "calendar" | "options";
  empty?: boolean;
  onOpen?: () => void;
  children: ReactNode;
};

function Picker({ label, value, icon: Icon, variant, empty, onOpen, children }: PickerProps) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);

  function show() {
    const box = trigger.current?.getBoundingClientRect();
    const panel = dialog.current;
    if (!box || !panel || panel.open) return;
    const below = window.innerHeight - box.bottom - 12;
    const above = box.top - 12;
    const preferredHeight = variant === "calendar" ? 380 : 280;
    const placeBelow = below >= preferredHeight || below >= above;
    panel.dataset.placement = placeBelow ? "below" : "above";
    panel.style.setProperty("--picker-x", box.left + "px");
    panel.style.setProperty("--picker-top", box.bottom + 8 + "px");
    panel.style.setProperty("--picker-bottom", window.innerHeight - box.top + 8 + "px");
    panel.style.setProperty("--picker-room", Math.max(placeBelow ? below : above, 180) + "px");
    delete panel.dataset.closing;
    onOpen?.();
    panel.showModal();
    setOpen(true);
  }

  function close() {
    const panel = dialog.current;
    if (!panel?.open || panel.dataset.closing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      panel.close();
      return;
    }
    panel.dataset.closing = "true";
    closeTimer.current = window.setTimeout(() => panel.close(), 240);
  }

  function closed() {
    window.clearTimeout(closeTimer.current);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (!open) return;
    dialog.current?.querySelector<HTMLElement>("[data-picker-focus]")?.focus({ preventScroll: true });
    return () => window.clearTimeout(closeTimer.current);
  }, [open]);

  return (
    <div className="picker-field">
      <button ref={trigger} type="button" className="booking-field picker-trigger"
        aria-label={label + ", " + value} aria-haspopup="dialog" aria-expanded={open}
        aria-controls={id} onClick={show}>
        <Icon className="field-icon" size={20} aria-hidden={true} />
        <span className="field-body">
          <span className="field-label">{label}</span>
          <span className="field-value" data-empty={empty}>{value}</span>
        </span>
        <ChevronDown className="picker-chevron" size={15} aria-hidden="true" />
      </button>
      <dialog className={"picker-dialog picker-" + variant} id={id} ref={dialog}
        aria-labelledby={id + "-label"} onClose={closed}
        onCancel={(event) => { event.preventDefault(); close(); }}
        onClick={(event) => {
          if (event.target === event.currentTarget ||
              (event.target instanceof Element && event.target.closest("[data-picker-dismiss]"))) {
            close();
          }
        }}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget && event.currentTarget.dataset.closing) {
            event.currentTarget.close();
          }
        }}>
        {open && <div className="picker-inner">
          <div className="picker-handle" aria-hidden="true" />
          <header className="picker-header">
            <h3 id={id + "-label"}>{label}</h3>
            <button type="button" className="picker-icon" aria-label="Закрыть" onClick={close}>
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          {children}
        </div>}
      </dialog>
    </div>
  );
}

type ChoiceProps = {
  label: string;
  value: number;
  icon: Icon;
  options: { value: number; label: string }[];
  onChange: (value: number) => void;
};

export function ChoicePicker({ label, value, icon, options, onChange }: ChoiceProps) {
  const list = useRef<HTMLDivElement>(null);

  function move(event: KeyboardEvent<HTMLDivElement>) {
    const buttons = Array.from(list.current?.querySelectorAll("button") ?? []);
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const direction = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!direction || current < 0) return;
    event.preventDefault();
    buttons[(current + direction + buttons.length) % buttons.length]?.focus();
  }

  return (
    <Picker label={label} value={options.find((option) => option.value === value)?.label ?? ""}
      icon={icon} variant="options">
      <div className="picker-choices" ref={list} onKeyDown={move} role="group" aria-label={label}>
          {options.map((option) =>
            <button type="button" key={option.value} aria-pressed={option.value === value}
              data-picker-focus={option.value === value || undefined}
              data-picker-dismiss onClick={() => onChange(option.value)}>
              {option.label}
              {option.value === value && <Check size={17} aria-hidden="true" />}
            </button>
          )}
      </div>
    </Picker>
  );
}

const longDate = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
});
const monthLabel = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" });
const displayDate = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC",
});
const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const asDate = (date: string) => new Date(date + "T00:00:00Z");
const toIso = (date: Date) => date.toISOString().slice(0, 10);
const firstOfMonth = (date: string) => date.slice(0, 7) + "-01";

export function shiftDays(iso: string, amount: number) {
  const date = asDate(iso);
  date.setUTCDate(date.getUTCDate() + amount);
  return toIso(date);
}

function shiftMonths(iso: string, amount: number) {
  const date = asDate(firstOfMonth(iso));
  date.setUTCMonth(date.getUTCMonth() + amount);
  return toIso(date);
}

function weekOffset(iso: string) {
  return (asDate(iso).getUTCDay() + 6) % 7;
}

type CalendarProps = {
  label: string;
  icon: Icon;
  value: string;
  min: () => string;
  max?: () => string;
  onChange: (date: string) => void;
};

export function DatePicker({ label, icon, value, min, max, onChange }: CalendarProps) {
  const [cursor, setCursor] = useState("");
  const grid = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ minimum: "", maximum: "9999-12-31" });
  const month = cursor ? firstOfMonth(cursor) : "";
  const start = month ? shiftDays(month, -weekOffset(month)) : "";
  const days = start ? Array.from({ length: 42 }, (_, index) => shiftDays(start, index)) : [];
  const previous = month ? shiftMonths(month, -1) : "";
  const next = month ? shiftMonths(month, 1) : "";
  const clampDate = (date: string) => date < bounds.minimum ? bounds.minimum : date > bounds.maximum ? bounds.maximum : date;

  function startCalendar() {
    const minimum = min();
    const maximum = max?.() || "9999-12-31";
    const selected = value || minimum;
    setBounds({ minimum, maximum });
    setCursor(selected < minimum ? minimum : selected > maximum ? maximum : selected);
  }

  function focusDay(date: string) {
    const target = clampDate(date);
    setCursor(target);
    requestAnimationFrame(() => grid.current?.querySelector<HTMLElement>('[data-calendar-day="' + target + '"]')?.focus());
  }

  function keys(event: KeyboardEvent<HTMLDivElement>) {
    if (!cursor || !(event.target instanceof HTMLButtonElement) || !event.target.dataset.calendarDay) return;
    const offsets: Record<string, number> = {
      ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7,
      Home: -weekOffset(cursor), End: 6 - weekOffset(cursor),
    };
    const step = offsets[event.key];
    if (step !== undefined) {
      event.preventDefault();
      focusDay(shiftDays(cursor, step));
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      focusDay(shiftMonths(cursor, event.key === "PageUp" ? -1 : 1));
    }
  }

  return (
    <Picker label={label} icon={icon} value={value ? displayDate.format(asDate(value)) : "Выбрать дату"}
      empty={!value} variant="calendar" onOpen={startCalendar}>
      {month && (
        <>
          <div className="calendar-month">
            <button type="button" className="picker-icon" aria-label="Предыдущий месяц"
              disabled={previous < firstOfMonth(bounds.minimum)} onClick={() => setCursor(clampDate(previous))}>
              <ChevronLeft size={19} aria-hidden="true" />
            </button>
            <p className="month-name" aria-live="polite">{monthLabel.format(asDate(month))}</p>
            <button type="button" className="picker-icon" aria-label="Следующий месяц"
              disabled={next > firstOfMonth(bounds.maximum)} onClick={() => setCursor(clampDate(next))}>
              <ChevronRight size={19} aria-hidden="true" />
            </button>
          </div>
          <div className="calendar-grid" ref={grid} role="group" aria-label={monthLabel.format(asDate(month))} onKeyDown={keys}>
            {weekdays.map((day) => <span key={day} aria-hidden="true">{day}</span>)}
            {days.map((day) => {
              const outside = firstOfMonth(day) !== month;
              const disabled = day < bounds.minimum || day > bounds.maximum;
              return (
                <button type="button" key={day} className="calendar-day"
                  aria-label={longDate.format(asDate(day))} aria-pressed={day === value}
                  data-outside={outside} data-picker-focus={day === cursor || undefined}
                  data-calendar-day={day}
                  tabIndex={day === cursor ? 0 : -1} disabled={disabled}
                  onFocus={() => { if (!outside && !disabled) setCursor(day); }}
                  data-picker-dismiss onClick={() => onChange(day)}>
                  {Number(day.slice(-2))}
                </button>
              );
            })}
          </div>
          {value && <button className="picker-clear" type="button" data-picker-dismiss onClick={() => onChange("")}>Очистить дату</button>}
        </>
      )}
    </Picker>
  );
}
