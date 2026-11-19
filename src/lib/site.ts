import settings from "../../content/site.json";

export const name = "У Лауры";
export const address = "ул. Шевченко, 3Б";
export const locality = "Лазаревское, Сочи";
export const fullAddress = "г. Сочи, Лазаревское, ул. Шевченко, 3Б";
export const mapUrl = "https://yandex.ru/maps/?text=" + encodeURIComponent(fullAddress);
export const config = settings;
export const consentVersion = config.consentVersion;
export const consentDate = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "long", timeZone: "UTC",
}).format(new Date(consentVersion + "T00:00:00Z"));
export const pagesPreview = process.env.NEXT_PUBLIC_PAGES_PREVIEW === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const bookingApiOrigin = process.env.NEXT_PUBLIC_BOOKING_API_ORIGIN || "";

export const publicAsset = (path: string) => basePath + path;
export const bookingEndpoint = (name: "quote" | "request") => bookingApiOrigin + "/api/" + name;

function httpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

const siteUrl = httpsUrl(config.url);
export const canonicalBase = pagesPreview ? undefined : siteUrl;
const registryUrl = httpsUrl(config.registry.url);
export const registry = config.registry.number && registryUrl
  ? { number: config.registry.number, url: registryUrl.href }
  : null;

export const hasPublicationDetails = Boolean(
  config.public && siteUrl && registry && config.phone && config.email &&
    config.operator.name && config.operator.address && config.dataRecipients && config.dataRetention,
);
export const isPublic = hasPublicationDetails && !pagesPreview;

export const telephoneHref = "tel:" + config.phone.replace(/[^+0-9]/g, "");
