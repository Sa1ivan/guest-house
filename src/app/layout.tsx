import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { canonicalBase, isPublic, name, publicAsset } from "@/lib/site";
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: canonicalBase,
  title: { default: "Гостевой дом «У Лауры» в Лазаревском", template: "%s | У Лауры" },
  description: "Гостевой дом «У Лауры» в Лазаревском, Сочи. Номера для двоих и семей, общая кухня и двор. Смотрите фотографии номеров и выбирайте даты.",
  robots: { index: isPublic, follow: isPublic },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: name,
    ...(canonicalBase ? { images: [{ url: publicAsset("/images/lazarevskoe.webp"), alt: "Панорама Лазаревского" }] } : {}),
  },
};

const themeScript = "try{var theme=localStorage.getItem('laury-theme');if(theme==='light'||theme==='dark')document.documentElement.dataset.theme=theme}catch(e){}";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <a className="skip-link" href="#main">К содержимому</a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
