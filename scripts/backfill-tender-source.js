const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const envPath = path.join(process.cwd(), ".env");

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

const prisma = new PrismaClient();

const GOVERNMENT_SOURCE_MARKERS = [
  "44-фз",
  "44 фз",
  "223-фз",
  "223 фз",
  "государствен",
  "госзаказ",
  "госзакуп",
  "муницип",
  "федеральн",
  "бюджетн",
  "казенн",
  "администрац",
  "минздрав",
  "минобр",
  "минцифр",
  "минфин",
  "минкульт",
  "минспорт",
  "гку",
  "фгбу",
  "мку",
  "гауз",
  "обуз",
  "гбуз",
  "госуслуг",
  "zakazrf",
  "гис",
  "гу",
  "фмба",
];

const COMMERCIAL_SOURCE_MARKERS = [
  "коммерчес",
  "b2b",
  "фабрикант",
  "росэлторг",
  "тендерпро",
  "ооо",
  "ао",
  "пао",
  "зао",
  "ип",
];

function inferSource(tender) {
  const combinedText = [
    tender.title,
    tender.description,
    tender.customer,
    tender.number,
    tender.sourceUrl,
    tender.sabyUrl,
    tender.url,
  ]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join(" \n ")
    .toLocaleLowerCase("ru-RU");

  if (GOVERNMENT_SOURCE_MARKERS.some((marker) => matchesSourceMarker(combinedText, marker))) {
    return "government";
  }

  if (COMMERCIAL_SOURCE_MARKERS.some((marker) => matchesSourceMarker(combinedText, marker))) {
    return "commercial";
  }

  return "unknown";
}

function matchesSourceMarker(text, marker) {
  if (marker.length >= 5) {
    return text.includes(marker);
  }

  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(marker)}([^\\p{L}\\p{N}]|$)`, "iu").test(
    text,
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
  const tenders = await prisma.tender.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      customer: true,
      number: true,
      sourceUrl: true,
      sabyUrl: true,
      url: true,
      source: true,
    },
  });

  let updated = 0;

  for (const tender of tenders) {
    const nextSource = inferSource(tender);

    if (nextSource === tender.source) {
      continue;
    }

    await prisma.tender.update({
      where: { id: tender.id },
      data: { source: nextSource },
    });
    updated += 1;
  }

  const summary = await prisma.tender.groupBy({
    by: ["source"],
    _count: { _all: true },
  });

  console.log(JSON.stringify({ updated, summary }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
