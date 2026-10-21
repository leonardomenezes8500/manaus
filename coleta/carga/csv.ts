// Minimal CSV line splitter (#15): commas, optional double quotes ("" inside quotes = one quote). No multi-line fields.
export function splitCsv(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') field += c, i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') out.push(field), (field = '');
    else field += c;
  }
  out.push(field);
  return out;
}

/** Turns lines (header first) into records keyed by header name; a line with the wrong field count is an error. */
export async function* records(lines: AsyncIterable<string>): AsyncGenerator<Record<string, string>> {
  let header: string[] | undefined;
  let n = 0;
  for await (const raw of lines) {
    n++;
    const line = raw.replace(/\r$/, '');
    if (!line) continue;
    const fields = splitCsv(line);
    if (!header) {
      header = fields.map((h) => h.trim());
      continue;
    }
    if (fields.length !== header.length) throw new Error(`line ${n}: ${fields.length} fields, header has ${header.length}`);
    yield Object.fromEntries(header.map((h, i) => [h, fields[i].trim()]));
  }
}
