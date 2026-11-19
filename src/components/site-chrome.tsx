"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, Menu, Moon, Sun, Waves } from "lucide-react";
import { useRef } from "react";
import { address, config, locality, registry, telephoneHref } from "@/lib/site";

const navigation = [
  { href: "/rooms/", label: "Номера" },
  { href: "/#about", label: "О доме" },
  { href: "/stay/", label: "Цены и условия" },
  { href: "/contacts/", label: "Как добраться" },
];

function Brand() {
  return (
    <Link className="brand" href="/" aria-label="У Лауры, главная">
      <span className="brand-mark"><Waves size={21} strokeWidth={1.7} aria-hidden="true" /></span>
      <span>У Лауры</span>
    </Link>
  );
}

function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const current = root.dataset.theme ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const theme = current === "dark" ? "light" : "dark";
    root.dataset.theme = theme;
    try { localStorage.setItem("laury-theme", theme); } catch { /* Browsing without storage. */ }
  }

  return (
    <button className="icon-button theme-toggle" type="button" onClick={toggle}
      aria-label="Переключить цветовую тему" title="Переключить цветовую тему">
      <Moon className="theme-moon" size={19} aria-hidden="true" />
      <Sun className="theme-sun" size={20} aria-hidden="true" />
    </button>
  );
}

export function SiteHeader() {
  const path = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  const isCurrent = (href: string) => !href.includes("#") && path.startsWith(href.slice(0, -1));

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Основная навигация">
          {navigation.map(({ href, label }) =>
            <Link key={href} href={href} aria-current={isCurrent(href) ? "page" : undefined}>{label}</Link>
          )}
        </nav>
        <div className="header-actions">
          <ThemeToggle />
          <Link className="button header-cta" href="/rooms/">Выбрать номер</Link>
          <details ref={menu} className="mobile-menu">
            <summary className="icon-button" aria-label="Открыть меню"><Menu size={22} aria-hidden="true" /></summary>
            <nav aria-label="Меню">
              {navigation.map(({ href, label }) => (
                <Link key={href} href={href} aria-current={isCurrent(href) ? "page" : undefined}
                  onClick={() => { if (menu.current) menu.current.open = false; }}>{label}</Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <div>
          <Brand />
          <Link className="footer-address" href="/contacts/">
            <MapPin size={17} aria-hidden="true" /> {locality}, {address}
          </Link>
          {config.phone && <a className="footer-phone" href={telephoneHref}>{config.phone}</a>}
        </div>
        <nav className="footer-nav" aria-label="Информация о сайте">
          <Link href="/stay/">Цены и условия</Link>
          <Link href="/contacts/">Контакты и проезд</Link>
          <Link href="/privacy/">Обработка данных</Link>
          {registry && <a href={registry.url}>Запись в реестре {registry.number}</a>}
        </nav>
        <p className="photo-credit">
          Фото Лазаревского. <a href="https://commons.wikimedia.org/wiki/File:Lazarevskoe_Panorama_by_Photo01.ru_2019.jpg">Панорама Serg Uspeshniy</a>,{" "}
          <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>, кадрирование.{" "}
          <a href="https://commons.wikimedia.org/wiki/File:Beach_in_Lazarevskoye,_Sochi.jpg">Пляж Bestalex</a>, CC0.
        </p>
      </div>
    </footer>
  );
}
