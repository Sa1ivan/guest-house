import roomsData from "../../content/rooms.json";
import housePhotosData from "../../content/house-photos.json";
import roomRatesData from "../../content/room-rates.json";
import { pagesPreview, publicAsset } from "@/lib/site";

export type Photo = { src: string; width: number; height: number; alt: string };

export type Room = {
  id: string;
  title: string;
  fullTitle: string;
  description: string;
  kind: "standard" | "economy";
  guests: number;
  extraBeds: number;
  extraBedKind: string;
  rooms: number;
  area: number;
  bathroom: string;
  views: string[];
  beds: { type: string; count: number }[];
  amenities: string[];
  images: Photo[];
};

type RatePeriod = { from: string; through: string; nightlyRub: number };

const withPublicPath = (photo: Photo): Photo => ({ ...photo, src: publicAsset(photo.src) });

export const rooms = (roomsData as Room[]).map((room) => ({
  ...room, images: room.images.map(withPublicPath),
}));
export const housePhotos = housePhotosData.map(withPublicPath);
export const roomRates: Record<string, RatePeriod[]> = roomRatesData;
export const maxGuests = Math.max(...rooms.map((room) => room.guests + room.extraBeds));
export const featuredRooms = [
  "standart-s-vidom-na-more",
  "ekonom-s-razdelnymi-krovatyami",
  "dvuhkomnatnyy-standart",
].map((id) => rooms.find((room) => room.id === id)!);

export const roomHref = (id: string) => "/rooms/" + id + "/";
export const hasRates = (id: string) => !pagesPreview && Boolean(roomRates[id]?.length);
