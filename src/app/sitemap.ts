import type { MetadataRoute } from "next";
import { isPublic, canonicalBase } from "@/lib/site";
import { roomHref, rooms } from "@/lib/catalog";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isPublic) return [];
  return ["/", "/rooms/", "/contacts/", "/stay/", ...rooms.map(({ id }) => roomHref(id))]
    .map((path) => ({ url: new URL(path, canonicalBase).href }));
}
