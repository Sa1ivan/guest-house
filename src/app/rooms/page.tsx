import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { RoomsCatalog } from "@/components/rooms-catalog";
import { StaySearch } from "@/components/stay-search";
import { hasRates, rooms } from "@/lib/catalog";
import { canonicalBase } from "@/lib/site";

export const metadata: Metadata = {
  title: "Номера в Лазаревском",
  description: "Фото и удобства всех категорий гостевого дома «У Лауры». Номера стандарт и эконом для двоих и семей.",
  alternates: canonicalBase ? { canonical: "/rooms/" } : undefined,
};

export default function RoomsPage() {
  return (
    <div className="shell page-body">
      <Breadcrumbs current="Номера" />
      <div className="page-intro">
        <h1>Номера</h1>
        <p>Сравните номера стандарт и эконом. Выберите даты поездки и укажите число гостей.</p>
      </div>
      <StaySearch catalog />
      <RoomsCatalog rooms={rooms} hasPublishedRates={rooms.some(({ id }) => hasRates(id))} />
    </div>
  );
}
