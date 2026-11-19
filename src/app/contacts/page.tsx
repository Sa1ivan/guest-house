import type { Metadata } from "next";
import { PhotoTrigger } from "@/components/photo-viewer";
import { MapPin, TrainFront, Waves } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { housePhotos } from "@/lib/catalog";
import { canonicalBase, config, fullAddress, mapUrl, registry, telephoneHref } from "@/lib/site";

export const metadata: Metadata = {
  title: "Контакты и проезд",
  description: "Адрес гостевого дома «У Лауры» в Лазаревском. Улица Шевченко, 3Б. Проложите маршрут от вокзала или набережной.",
  alternates: canonicalBase ? { canonical: "/contacts/" } : undefined,
};

export default function ContactsPage() {
  return (
    <div className="shell page-body">
      <Breadcrumbs current="Как добраться" />
      <div className="page-intro">
        <h1>Как добраться</h1>
        <p>Гостевой дом «У Лауры» находится в центре Лазаревского.</p>
      </div>
      <div className="contact-grid">
        <section className="information-card contact-card">
          <h2>Адрес</h2>
          <p className="location-address"><MapPin size={21} aria-hidden="true" /> {fullAddress}</p>
          <ul className="contact-ways">
            <li><TrainFront size={20} aria-hidden="true" /> Около 700 м до ж/д вокзала</li>
            <li><Waves size={20} aria-hidden="true" /> 12–15 минут пешком до центральной набережной</li>
          </ul>
          <a className="button" href={mapUrl}>Построить маршрут</a>
          {(config.phone || config.email) && <div className="contact-links">
            {config.phone && <a className="text-link" href={telephoneHref}>{config.phone}</a>}
            {config.email && <a className="text-link" href={"mailto:" + config.email}>{config.email}</a>}
          </div>}
          {registry && <p className="register-line"><a href={registry.url}>Запись в реестре {registry.number}</a></p>}
        </section>
        <figure className="contact-photo">
          <PhotoTrigger photos={housePhotos} />
          <figcaption>Вход во двор гостевого дома</figcaption>
        </figure>
      </div>
    </div>
  );
}
