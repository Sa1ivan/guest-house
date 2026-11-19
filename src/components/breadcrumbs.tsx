import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function Breadcrumbs({ current, rooms = false }: { current: string; rooms?: boolean }) {
  return (
    <nav className="breadcrumbs" aria-label="Хлебные крошки">
      <Link href="/">Главная</Link><ChevronRight size={13} aria-hidden="true" />
      {rooms && <><Link href="/rooms/">Номера</Link><ChevronRight size={13} aria-hidden="true" /></>}
      <span aria-current="page">{current}</span>
    </nav>
  );
}
