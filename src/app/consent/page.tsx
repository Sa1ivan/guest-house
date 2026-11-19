import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { config, consentDate, hasPublicationDetails } from "@/lib/site";

export const metadata: Metadata = { title: "Согласие на обработку персональных данных" };

export default function ConsentPage() {
  return (
    <div className="shell page-body">
      <Breadcrumbs current="Согласие на обработку данных" />
      <article className="legal-body">
        <h1>Согласие на обработку персональных данных</h1>
        <p className="muted">Редакция от {consentDate}</p>
        {!hasPublicationDetails && <p className="notice">Версия для предпросмотра. Согласие применяется после публикации реквизитов оператора и открытия формы заявок.</p>}
        <p>Отмечая согласие в форме заявки, я разрешаю {config.operator.name || "оператору гостевого дома"} обрабатывать мои данные для ответа на заявку и согласования условий проживания.</p>
        <h2>Что входит в согласие</h2>
        <p>Имя, телефон, даты, категория номера, число гостей и допмест, стоимость, текст пожеланий и сведения о согласии. Оператор может получить данные из формы, передать их указанным получателям, использовать для связи с гостем, уточнить или удалить. Анкета передаётся одним сообщением в личный чат владельца в Telegram. {config.dataRecipients && config.dataRecipients}</p>
        <h2>Срок и порядок отзыва</h2>
        <p>Согласие действует на срок обработки заявки. {config.dataRetention || "Срок хранения сообщений указывается перед открытием формы."} {config.email
          ? <>Согласие можно отозвать по адресу <a href={"mailto:" + config.email}>{config.email}</a>.</>
          : "Адрес для отзыва согласия указывается в реквизитах оператора."}</p>
        <p>Подробнее читайте в <Link href="/privacy/">политике обработки персональных данных</Link>.</p>
      </article>
    </div>
  );
}
