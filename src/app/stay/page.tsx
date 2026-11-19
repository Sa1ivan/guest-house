import type { Metadata } from "next";
import Link from "next/link";
import { BedDouble, CalendarDays, Moon, UsersRound } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { canonicalBase, registry } from "@/lib/site";

export const metadata: Metadata = {
  title: "Цены и условия проживания",
  description: "Условия заезда, оплаты и проживания в гостевом доме «У Лауры». Стоимость дополнительных мест по месяцам.",
  alternates: canonicalBase ? { canonical: "/stay/" } : undefined,
};

const rules = [
  { icon: CalendarDays, title: "Заезд и выезд", text: "Время заезда и выезда согласовывается с владельцем." },
  { icon: UsersRound, title: "Семьи с детьми", text: "Принимаем детей любого возраста. При выборе номера учитывайте каждого гостя." },
  { icon: Moon, title: "Тихие часы", text: "С 23:00 до 08:00. Размещение с животными и проведение мероприятий не предусмотрены." },
  { icon: BedDouble, title: "Оплата и отмена", text: "При заселении доступны наличные и оплата картой через терминал. Условия отмены уточняются при подтверждении." },
];

export default function StayPage() {
  return (
    <div className="shell page-body">
      <Breadcrumbs current="Цены и условия" />
      <div className="page-intro">
        <h1>Цены и условия</h1>
        <p>Стоимость номера зависит от категории и дат. Наличие и условия поездки подтверждает владелец.</p>
      </div>
      <div className="information-grid">
        <section className="information-card">
          <h2>Дополнительное место</h2>
          <p>Тариф за одну раскладушку или раскладное кресло за ночь.</p>
          <dl className="tariff-table">
            <div><dt>Июль и август</dt><dd>1 000 ₽</dd></div>
            <div><dt>Остальные месяцы</dt><dd>500 ₽</dd></div>
          </dl>
          <p>В большинстве номеров доступно одно допместо. В двухкомнатном стандарте можно добавить два.</p>
          <Link className="button" href="/rooms/">Выбрать даты и номер</Link>
        </section>
        <section className="information-card">
          <h2>Правила проживания</h2>
          <ul className="facility-list">
            {rules.map(({ icon: Icon, title, text }) =>
              <li key={title}><span className="facility-icon"><Icon size={20} aria-hidden="true" /></span>
                <span><strong>{title}</strong><span>{text}</span></span>
              </li>
            )}
          </ul>
          <p>Курение на территории разрешено в отведённых местах.</p>
        </section>
      </div>
      {registry && <p className="register-line"><a href={registry.url}>Запись в реестре {registry.number}</a></p>}
    </div>
  );
}
