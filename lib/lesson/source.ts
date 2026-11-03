// Lesson text built from several documents, each opened by a header line the model can read.
const documentHeader = (name: string) => `=== Document: ${name} ===`;
const DOCUMENT_START = /(?=^=== Document: )/m;
const PART_END = "\n\n";

// Trims to the limit fairly: short documents keep everything and long ones share the rest.
export function shareSource(source: string, limit: number): string {
  const parts = source.split(DOCUMENT_START);
  const allowed = new Map<number, number>();
  // Each part ends on a blank line so the next header still opens a line after trimming.
  let remaining = limit - parts.length * PART_END.length;
  const shortestFirst = parts.map((part, i) => ({ i, length: part.length })).sort((a, b) => a.length - b.length);
  shortestFirst.forEach(({ i, length }, done) => {
    const take = Math.min(length, Math.floor(remaining / (parts.length - done)));
    allowed.set(i, take);
    remaining -= take;
  });
  return parts.map((part, i) => part.slice(0, allowed.get(i)).trimEnd() + PART_END).join("");
}

export function joinDocuments(docs: { name: string; text: string }[], limit: number): string {
  const joined = docs.map((d) => `${documentHeader(d.name)}\n${d.text.trim()}${PART_END}`).join("");
  return shareSource(joined, limit);
}
