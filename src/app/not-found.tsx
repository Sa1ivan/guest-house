import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell page-body">
      <div className="page-intro">
        <h1>Страница не найдена</h1>
        <p>Проверьте адрес или вернитесь к каталогу.</p>
      </div>
      <Link className="button" href="/rooms/">Все номера</Link>
    </div>
  );
}
