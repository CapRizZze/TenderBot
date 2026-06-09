const fs = require("fs");
const har = JSON.parse(fs.readFileSync("trade.saby.ru.har", "utf8"));
const entry = har.log.entries.find(e => e.request && e.request.postData && typeof e.request.postData.text === "string" && e.request.postData.text.includes("\"method\":\"Tender.GetList\""));
if (!entry) throw new Error("Tender.GetList payload not found in HAR");
fs.writeFileSync("tmp-tender-getlist-live.json", entry.request.postData.text, "utf8");
