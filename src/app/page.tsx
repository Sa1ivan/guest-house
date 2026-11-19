import Link from "next/link";
import type { Metadata } from "next";
import { Clock3, CookingPot, MapPin, TreeDeciduous, Wifi } from "lucide-react";
import { featuredRooms, housePhotos } from "@/lib/catalog";
import { address, canonicalBase, config, fullAddress, isPublic, locality, mapUrl, publicAsset, registry } from "@/lib/site";
import { RoomCard } from "@/components/room-card";
import { PhotoTrigger } from "@/components/photo-viewer";
import { StaySearch } from "@/components/stay-search";

export const metadata: Metadata = {
  alternates: canonicalBase ? { canonical: "/" } : undefined,
};

const facilities = [
  { icon: CookingPot, label: "Общая кухня", text: "Можно готовить самостоятельно." },
  { icon: TreeDeciduous, label: "Двор с мангалом", text: "Под навесом есть столы и места для отдыха." },
  { icon: Wifi, label: "Wi-Fi", text: "Интернет доступен в номерах." },
];

export default function Home() {
  const house = housePhotos[0];
  const panorama = {
    src: publicAsset("/images/lazarevskoe.webp"), alt: "Панорама Лазаревского с Чёрным морем",
    width: 2300, height: 874,
  };
  const beach = { src: publicAsset("/images/beach.webp"), alt: "Галечный пляж Лазаревского и горы", width: 1050, height: 700 };
  const structuredData = isPublic ? {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: "Гостевой дом «У Лауры»",
    url: canonicalBase?.href,
    image: new URL(house.src, canonicalBase).href,
    telephone: config.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: "ул. Шевченко, 3Б",
      addressLocality: "Лазаревское, Сочи",
      addressRegion: "Краснодарский край",
      addressCountry: "RU",
    },
    ...(registry ? { identifier: registry.number } : {}),
  } : null;

  return (
    <>
      {structuredData && <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
      }} />}

      <div className="shell home">
        <section className="hero" aria-labelledby="home-title">
          <div className="hero-copy">
            <p className="location-label"><MapPin size={16} strokeWidth={1.8} aria-hidden="true" /> {locality}</p>
            <h1 id="home-title">Гостевой дом<br /><em>«У Лауры»</em></h1>
            <p className="hero-intro">Номера для двоих и семей. Центральная набережная в 12–15 минутах пешком.</p>
            <Link className="button hero-link" href="/rooms/">Смотреть номера</Link>
          </div>
          <figure className="hero-photo">
            <PhotoTrigger photos={[panorama, beach]} className="hero-photo-trigger" showExpand={false}>
              <picture>
                <source media="(max-width: 720px)" srcSet={publicAsset("/images/lazarevskoe-small.webp")} />
                <img src={panorama.src} width={panorama.width} height={panorama.height}
                  fetchPriority="high" alt={panorama.alt} />
              </picture>
            </PhotoTrigger>
            <figcaption><MapPin size={14} aria-hidden="true" /> Панорама Лазаревского</figcaption>
          </figure>
        </section>

        <StaySearch />

        <section className="section home-rooms" aria-labelledby="featured-title">
          <div className="section-heading" data-reveal>
            <div>
              <h2 id="featured-title">Номера</h2>
              <p>С видом на море, горы или двор.</p>
            </div>
            <Link className="button button-outline" href="/rooms/">Все номера</Link>
          </div>
          <div className="room-grid">{featuredRooms.map((room) => <RoomCard room={room} key={room.id} />)}</div>
        </section>

        <section className="section about" id="about" aria-labelledby="about-title">
          <div className="about-photos" data-reveal>
            <PhotoTrigger photos={housePhotos} />
            <PhotoTrigger photos={housePhotos} index={1} className="about-secondary" />
          </div>
          <div className="about-copy" data-reveal>
            <h2 id="about-title">О доме</h2>
            <p>Дом стоит в центре Лазаревского. До рынка, парка и магазинов можно дойти пешком.</p>
            <ul className="facility-list">
              {facilities.map(({ icon: Icon, label, text }) =>
                <li key={label}>
                  <span className="facility-icon"><Icon size={21} strokeWidth={1.6} aria-hidden="true" /></span>
                  <span><strong>{label}</strong><span>{text}</span></span>
                </li>
              )}
            </ul>
            <Link className="text-link" href="/stay/">Условия проживания</Link>
          </div>
        </section>

        <section className="section location-panel" aria-labelledby="location-title" data-reveal>
          <div className="location-copy">
            <h2 id="location-title">Как добраться</h2>
            <p className="location-address"><MapPin size={20} aria-hidden="true" /> {fullAddress}</p>
            <p><Clock3 size={18} aria-hidden="true" /> 12–15 минут пешком до набережной</p>
            <a className="button" href={mapUrl}>Открыть Яндекс Карты</a>
          </div>
          <PhotoTrigger className="location-photo" photos={[beach, panorama]} />
        </section>

        {registry && <p className="register-line">
          <MapPin size={15} aria-hidden="true" /> {address} · <a href={registry.url}>Запись в реестре {registry.number}</a>
        </p>}
      </div>
    </>
  );
}
