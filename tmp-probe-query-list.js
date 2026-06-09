const fs = require("fs");
const parents = [null, 0, -1, -4, 1, 854874];
for (const parent of parents) {
  const body = {
    jsonrpc: "2.0",
    protocol: 7,
    method: "Query.query_list",
    params: {
      "Фильтр": {
        d: [false, parent, true, true, 1, true],
        s: [
          { t: "Логическое", n: "is_new_rp" },
          { t: "Число целое", n: "parent" },
          { t: "Логическое", n: "show_interesting_comp" },
          { t: "Логическое", n: "show_our_industry" },
          { t: "Число целое", n: "tenderType" },
          { t: "Логическое", n: "user_folders_first" }
        ],
        _type: "record",
        f: 0
      },
      "Сортировка": null,
      "Навигация": {
        d: [true, 100, 0],
        s: [
          { t: "Логическое", n: "ЕстьЕще" },
          { t: "Число целое", n: "РазмерСтраницы" },
          { t: "Число целое", n: "Страница" }
        ],
        _type: "record",
        f: 0
      },
      "ДопПоля": []
    },
    id: 1
  };
  fs.writeFileSync("tmp-query-list.json", JSON.stringify(body), "utf8");
  const { execFileSync } = require("child_process");
  let out = "";
  try {
    out = execFileSync("curl.exe", [
      "-s",
      "https://trade.saby.ru/tender/service/?x_version=26.3202-36.4",
      "-H", "Content-Type: application/json; charset=utf-8",
      "-H", "Origin: https://trade.saby.ru",
      "-H", "Referer: https://trade.saby.ru/page/tenders-subscriptions",
      "-H", `Cookie: sid=${process.env.SABY_SID}`,
      "-H", `X-SBISSessionID: ${process.env.SABY_SID}`,
      "--data-binary", "@tmp-query-list.json"
    ], { encoding: "utf8" });
    const parsed = JSON.parse(out);
    const rows = parsed.result?.d || [];
    const cols = parsed.result?.s?.map(x => x.n) || [];
    console.log(`PARENT=${parent}`);
    console.log(`ROWS=${rows.length}`);
    for (const row of rows.slice(0, 10)) {
      const obj = {};
      for (let i = 0; i < cols.length; i++) obj[cols[i]] = row[i];
      console.log(JSON.stringify({ id: obj.id, name: obj.name, parent: obj.parent, kind: obj.kind, active: obj.active, total_app_receiving_count: obj.total_app_receiving_count }));
    }
    console.log("---");
  } catch (e) {
    console.log(`PARENT=${parent}`);
    console.log(String(out || e.stdout || e.message));
    console.log("---");
  }
}
