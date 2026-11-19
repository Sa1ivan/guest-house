import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BedDouble, Check, DoorOpen } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { RoomBooking } from "@/components/room-booking";
import { RoomFacts } from "@/components/room-card";
import { RoomGallery } from "@/components/room-gallery";
import { hasRates, roomHref, rooms } from "@/lib/catalog";
import { canonicalBase, registry } from "@/lib/site";

type Props = { params: Promise<{ room: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => rooms.map((item) => ({ room: item.id }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { room: id } = await params;
  const room = rooms.find((item) => item.id === id);
  if (!room) return {};

  return {
    title: room.fullTitle + " в Лазаревском",
    description: room.description + " Гостевой дом «У Лауры», Сочи.",
    alternates: canonicalBase ? { canonical: roomHref(id) } : undefined,
    ...(canonicalBase ? { openGraph: { images: [{ url: room.images[0].src, alt: room.images[0].alt }] } } : {}),
  };
}

export default async function RoomPage({ params }: Props) {
  const { room: id } = await params;
  const room = rooms.find((item) => item.id === id);
  if (!room) notFound();

  return (
    <div className="shell page-body">
      <Breadcrumbs rooms current={room.title} />
      <div className="page-intro room-intro">
        <h1>{room.title}</h1>
        <RoomFacts room={room} />
      </div>
      <div className="room-layout">
        <div className="room-details">
          <RoomGallery photos={room.images} />
          <section className="room-description" aria-labelledby="room-description">
            <h2 id="room-description">О номере</h2>
            <p>{room.description}</p>
            <ul className="description-facts">
              <li><DoorOpen size={19} aria-hidden="true" /> {room.rooms === 1 ? "Одна комната" : "Две комнаты"}</li>
              <li><BedDouble size={19} aria-hidden="true" /> {room.extraBeds === 1 ? "1 допместо" : "До " + room.extraBeds + " допмест"}</li>
            </ul>
            <h3>Спальные места</h3>
            <ul className="room-amenities">
              {room.beds.map((bed) => <li key={bed.type}><Check size={16} aria-hidden="true" /> {bed.type} × {bed.count}</li>)}
            </ul>
            <h3>Удобства</h3>
            <ul className="room-amenities">
              {room.amenities.map((item) => <li key={item}><Check size={16} aria-hidden="true" /> {item}</li>)}
            </ul>
          </section>
        </div>
        <RoomBooking id={id} extraBeds={room.extraBeds} extraBedKind={room.extraBedKind}
          hasPublishedRates={hasRates(id)} includedGuests={room.guests} />
      </div>
      {registry && <p className="register-line"><a href={registry.url}>Запись в реестре {registry.number}</a></p>}
    </div>
  );
}
