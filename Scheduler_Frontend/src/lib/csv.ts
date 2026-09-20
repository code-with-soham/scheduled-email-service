export type ParsedLeads = { emails: string[]; invalidCount: number };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function parseLeads(text: string): ParsedLeads {
  const candidates = text.split(/[\s,;\r\n]+/).map((value) => value.trim()).filter(Boolean);
  const emails = new Set<string>();
  let invalidCount = 0;
  for (const candidate of candidates) {
    if (emailPattern.test(candidate)) emails.add(candidate.toLowerCase());
    else invalidCount += 1;
  }
  return { emails: [...emails], invalidCount };
}
