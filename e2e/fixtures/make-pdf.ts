import { PDFDocument, StandardFonts } from "pdf-lib";

const PAGE_TEXT = [
  [
    "Photosynthesis",
    "",
    "Photosynthesis is how green plants make their own food.",
    "Leaves contain chlorophyll, a green pigment that captures sunlight.",
    "The plant takes in carbon dioxide from the air through tiny holes",
    "called stomata, and draws water up from the soil through its roots.",
  ],
  [
    "The Process",
    "",
    "Using the energy of sunlight, the plant turns carbon dioxide and",
    "water into glucose, a simple sugar that fuels growth.",
    "Oxygen is released into the air as a by-product.",
    "Without photosynthesis, animals would have no food or oxygen.",
  ],
];

async function buildPdf(pages: string[][]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) {
    const page = doc.addPage();
    const { height } = page.getSize();
    lines.forEach((line, i) => {
      page.drawText(line, { x: 50, y: height - 80 - i * 24, size: i === 0 ? 22 : 13, font });
    });
  }
  return Buffer.from(await doc.save());
}

export function makePhotosynthesisPdf(): Promise<Buffer> {
  return buildPdf(PAGE_TEXT);
}

export function makeVolcanoPdf(): Promise<Buffer> {
  return buildPdf([
    [
      "Volcanoes",
      "",
      "A volcano is an opening in the crust of the Earth.",
      "Molten rock called magma rises and erupts as lava.",
    ],
  ]);
}

export function makeLongPdf(pageCount = 11): Promise<Buffer> {
  const pages = Array.from({ length: pageCount }, (_, i) => [
    `Page ${i + 1}`,
    "",
    "This page only exists to push the document over the page limit.",
  ]);
  return buildPdf(pages);
}
