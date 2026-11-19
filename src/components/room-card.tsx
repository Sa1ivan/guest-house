import Link from "next/link";
import { Bath, BedDouble, Maximize, UsersRound } from "lucide-react";
import { PhotoTrigger } from "@/components/photo-viewer";
import type { Room } from "@/lib/catalog";
import { roomHref } from "@/lib/catalog";
import { decimal, guestLabel } from "@/lib/format";

export function RoomFacts({ room }: { room: Room }) {
  return (
    <ul className="room-facts">
      <li><UsersRound size={16} aria-hidden="true" /> {guestLabel(room.guests)}</li>
      <li><Maximize size={15} aria-hidden="true" /> {decimal(room.area)} м²</li>
      <li><Bath size={16} aria-hidden="true" /> Санузел {room.bathroom}</li>
    </ul>
  );
}

export function RoomCard({ room, availability }: { room: Room; availability?: string }) {
  return (
    <article className="room-card" data-reveal>
      <div className="room-photo">
        <PhotoTrigger photos={room.images} />
        <span className="room-kind">{room.kind === "economy" ? "Эконом" : "Стандарт"}</span>
      </div>
      <div className="room-card-body">
        <h3><Link href={roomHref(room.id)}>{room.title}</Link></h3>
        <RoomFacts room={room} />
        <p>{room.description}</p>
        <div className="room-card-bottom">
          {availability
            ? <span className="card-price">{availability}</span>
            : <span className="extra-summary"><BedDouble size={17} aria-hidden="true" />
                {room.extraBeds === 1 ? "1 допместо" : "До " + room.extraBeds + " допмест"}
              </span>}
          <Link className="text-link" href={roomHref(room.id)}>Подробнее<span className="visually-hidden"> — {room.title}</span></Link>
        </div>
      </div>
    </article>
  );
}
