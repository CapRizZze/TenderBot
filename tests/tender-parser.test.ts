import assert from "node:assert/strict";
import test from "node:test";

import { buildTenderConversationTitle } from "../lib/conversation-title.ts";
import {
  buildSabyMethodParams,
  buildSabyTenderDocumentLookupRequests,
  buildSabyV4MethodParamsForRequestName,
  filterTendersByKeywords,
  isSabyUrl,
  normalizeSabyDailyLimitStatistics,
  normalizeSabyResultToTenders,
} from "../lib/tender-parser/tenderParserService.ts";

test("normalizeSabyResultToTenders parses russian aliases and attachments", () => {
  const tenders = normalizeSabyResultToTenders({
    result: {
      tenders: [
        {
          Идентификатор: "243100291",
          Номер: "0166300024726000721",
          Название: "Поставка серверов",
          Описание: "Закупка серверного оборудования",
          Заказчик: "ООО Альфа",
          Ссылка: "https://zakupki.example/tender/243100291",
          КарточкаСсылка: "https://online.saby.ru/tender/243100291",
          proctype_name: "Электронный аукцион",
          proctype_brief: "ОА",
          tpbrief: "ZakazRF (44)",
          tradingplatformurl: "http://etp.zakazrf.ru",
          tptypename: "44-ФЗ",
          Документы: [
            {
              Название: "spec.pdf",
              Ссылка: "https://cdn.example/spec.pdf",
              Размер: "1 024",
            },
          ],
        },
      ],
    },
  });

  assert.equal(tenders.length, 1);
  assert.equal(tenders[0]?.id, "243100291");
  assert.equal(tenders[0]?.number, "0166300024726000721");
  assert.equal(tenders[0]?.title, "Поставка серверов");
  assert.equal(tenders[0]?.customer, "ООО Альфа");
  assert.equal(tenders[0]?.sourceUrl, "https://zakupki.example/tender/243100291");
  assert.equal(tenders[0]?.sabyUrl, "https://online.saby.ru/tender/243100291");
  assert.equal(tenders[0]?.procurementType, "Электронный аукцион");
  assert.equal(tenders[0]?.procurementTypeBrief, "ОА");
  assert.equal(tenders[0]?.sourcePlatformName, "ZakazRF (44)");
  assert.equal(tenders[0]?.sourcePlatformUrl, "http://etp.zakazrf.ru");
  assert.equal(tenders[0]?.regulationName, "44-ФЗ");
  assert.equal(tenders[0]?.attachments.length, 1);
  assert.deepEqual(tenders[0]?.attachments[0], {
    name: "spec.pdf",
    url: "https://cdn.example/spec.pdf",
    size: 1024,
  });
});

test("filterTendersByKeywords keeps only matching cached tenders", () => {
  const tenders = filterTendersByKeywords(
    [
      {
        id: "1",
        title: "Поставка серверов",
        description: "Серверы и СХД",
        customer: "ООО Альфа",
        deadline: "2026-06-20T18:00:00.000Z",
        url: "https://example.com/1",
        attachments: [],
      },
      {
        id: "2",
        title: "Поддержка CRM",
        description: "Сопровождение CRM",
        customer: "ООО Бета",
        deadline: "2026-06-30T18:00:00.000Z",
        url: "https://example.com/2",
        attachments: [],
      },
    ],
    ["серверы"],
  );

  assert.equal(tenders.length, 1);
  assert.equal(tenders[0]?.id, "1");
});

test("buildSabyV4MethodParamsForRequestName returns descending fallback payloads", () => {
  const payloads = buildSabyV4MethodParamsForRequestName("серверы", 1);
  const first = payloads[0] as {
    params: { requestName: string; limit?: number; fromPublishDateTime?: string };
  };
  const second = payloads[1] as {
    params: { requestName: string; limit?: number };
  };
  const third = payloads[2] as {
    params: { requestName: string };
  };

  assert.equal(payloads.length, 3);
  assert.equal(first.params.requestName, "серверы");
  assert.equal(first.params.limit, 1);
  assert.ok(typeof first.params.fromPublishDateTime === "string");
  assert.equal(second.params.requestName, "серверы");
  assert.equal(third.params.requestName, "серверы");
});

test("buildSabyMethodParams uses correct russian Saby keys", () => {
  const payloads = buildSabyMethodParams(["серверы"], 1);

  assert.deepEqual(payloads[2], {
    Параметр: {
      Навигация: {
        РазмерСтраницы: 1,
        Страница: 0,
      },
    },
  });

  assert.deepEqual(payloads[4], {
    Параметр: {
      Поиск: "серверы",
      Навигация: {
        РазмерСтраницы: 1,
        Страница: 0,
      },
    },
  });
});

test("buildSabyTenderDocumentLookupRequests prefers id and number lookups", () => {
  const requests = buildSabyTenderDocumentLookupRequests({
    externalId: "243100291",
    number: "0166300024726000721",
  });

  assert.deepEqual(requests, [
    {
      method: "SbisTenderAPI.GetTenderListByID",
      params: {
        params: {
          ids: [243100291],
        },
      },
    },
    {
      method: "SbisTenderAPI.GetTenderListByNumber",
      params: {
        params: {
          number: "0166300024726000721",
        },
      },
    },
  ]);
});

test("normalizeSabyDailyLimitStatistics calculates remaining when field is absent", () => {
  const statistics = normalizeSabyDailyLimitStatistics({
    dayCounter: 185,
    dayLimit: 200,
  });

  assert.deepEqual(statistics, {
    dayCounter: 185,
    dayLimit: 200,
    dayRemaining: 15,
  });
});

test("isSabyUrl distinguishes Saby links from external source links", () => {
  assert.equal(isSabyUrl("https://online.saby.ru/tender/243100291"), true);
  assert.equal(isSabyUrl("https://cdn2.saby.ru/static/file.pdf"), true);
  assert.equal(isSabyUrl("https://zakupki.example/tender/243100291"), false);
});

test("buildTenderConversationTitle combines title and customer with truncation", () => {
  const title = buildTenderConversationTitle({
    id: "1",
    title: "A".repeat(140),
    description: "Описание",
    customer: "B".repeat(60),
    deadline: "2026-06-20T18:00:00.000Z",
    url: "https://example.com/1",
    attachments: [],
  });

  assert.equal(title.endsWith("..."), true);
  assert.equal(title.length, 160);
});
