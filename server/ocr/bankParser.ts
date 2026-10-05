export interface ParsedBankMovement {
  fecha: string;
  descripcion: string;
  referencia: string;
  cargo: number;
  abono: number;
  saldo?: number;
  categoria: string;
  confianza: number;
  fuente: 'DOCUMENT_AI_TABLE';
}

export interface BankParseResult {
  bancoEmisor: string;
  parser: string;
  movimientos: ParsedBankMovement[];
  confidence: number;
  tableDetected: boolean;
  warnings: string[];
}

function cleanText(value: any) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function money(value: any): number {
  let raw = cleanText(value);
  if (!raw) return 0;

  raw = raw.replace(/[()$\s]/g, '');
  if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(raw)) {
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else {
    raw = raw.replace(/,/g, '');
  }

  const n = Number(raw);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

function findColumn(cells: string[], patterns: RegExp[]) {
  return cells.findIndex((cell) => patterns.some((pattern) => pattern.test(cleanText(cell).toUpperCase())));
}

function findHeader(tableRows: string[][]) {
  for (let i = 0; i < tableRows.length; i++) {
    const row = tableRows[i].map(cleanText);
    const joined = row.join(' | ').toUpperCase();

    const cargo = findColumn(row, [/^CARGOS?$/i, /CARGO/i]);
    const abono = findColumn(row, [/^ABONOS?$/i, /ABONO/i]);
    const saldo = findColumn(row, [/SALDO LIQUIDACION/i, /^SALDO$/i]);
    const fecha = findColumn(row, [/FECHA OPER/i, /^FECHA$/i]);
    const descripcion = findColumn(row, [/DESCRIPC/i]);
    const referencia = findColumn(row, [/REFERENCIA/i]);

    if (cargo >= 0 && abono >= 0 && (descripcion >= 0 || /DETALLE DE MOVIMIENTOS|MOVIMIENTOS REALIZADOS/.test(joined))) {
      return { index: i, cargo, abono, saldo, fecha, descripcion, referencia };
    }
  }

  return null;
}

function detectBank(text: string, rows: string[][]) {
  const haystack = [text, ...rows.flat()].join(' ').toUpperCase();
  if (/BBVA|BANCOMER|DETALLE DE MOVIMIENTOS REALIZADOS|SALDO LIQUIDACION/.test(haystack)) return 'BBVA';
  if (/BANORTE/.test(haystack)) return 'BANORTE';
  if (/SANTANDER/.test(haystack)) return 'SANTANDER';
  if (/HSBC/.test(haystack)) return 'HSBC';
  if (/AFIRME/.test(haystack)) return 'AFIRME';
  return 'OTRO';
}

function isLikelyDate(value: string) {
  return /\b\d{1,2}[\/-](?:\d{1,2}|[A-Z]{3})[\/-]\d{2,4}\b|^\d{1,2}\s+[A-Z]{3}\b/i.test(value);
}

export function parseBankTables(text: string, tableRows: Array<{cells: string[]; page: number}>): BankParseResult {
  const rows = tableRows.map((r) => r.cells.map(cleanText));
  const bancoEmisor = detectBank(text, rows);
  const warnings: string[] = [];

  if (!rows.length) {
    return {
      bancoEmisor,
      parser: 'NONE',
      movimientos: [],
      confidence: 0,
      tableDetected: false,
      warnings: ['Document AI no devolvió tablas.'],
    };
  }

  const header = findHeader(rows);
  if (!header) {
    return {
      bancoEmisor,
      parser: 'GENERIC_TABLE',
      movimientos: [],
      confidence: 0.35,
      tableDetected: false,
      warnings: ['No se encontró una cabecera con CARGOS/ABONOS.'],
    };
  }

  const movimientos: ParsedBankMovement[] = [];
  const seen = new Set<string>();

  for (let i = header.index + 1; i < rows.length; i++) {
    const row = rows[i];
    const cargo = money(row[header.cargo]);
    const abono = money(row[header.abono]);
    const saldo = header.saldo >= 0 ? money(row[header.saldo]) : undefined;
    const fecha = header.fecha >= 0 ? cleanText(row[header.fecha]) : '';
    const descripcion = header.descripcion >= 0
      ? cleanText(row[header.descripcion])
      : cleanText(row.slice(0, Math.max(header.cargo, header.abono)).join(' '));
    const referencia = header.referencia >= 0 ? cleanText(row[header.referencia]) : '';

    if (!descripcion || (!cargo && !abono)) continue;
    if (/TOTAL|CARGOS OBJETADOS|ABONOS OBJETADOS|SALDO INICIAL|SALDO FINAL/i.test(descripcion)) continue;

    const fingerprint = [fecha, descripcion, referencia, cargo.toFixed(2), abono.toFixed(2), saldo ?? ''].join('|');
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    const confidence =
      cargo > 0 || abono > 0
        ? (fecha && isLikelyDate(fecha) && saldo !== undefined ? 0.99 : 0.94)
        : 0.60;

    movimientos.push({
      fecha,
      descripcion,
      referencia,
      cargo,
      abono,
      saldo,
      categoria: 'OTROS',
      confianza: confidence,
      fuente: 'DOCUMENT_AI_TABLE',
    });
  }

  if (!movimientos.length) {
    warnings.push('Se detectó la tabla, pero no se pudieron extraer movimientos con CARGOS/ABONOS.');
  }

  const confidence = movimientos.length
    ? Math.round((movimientos.reduce((sum, m) => sum + m.confianza, 0) / movimientos.length) * 100) / 100
    : 0;

  return {
    bancoEmisor,
    parser: bancoEmisor === 'BBVA' ? 'BBVA_TABLE_V1' : 'GENERIC_TABLE_V1',
    movimientos,
    confidence,
    tableDetected: true,
    warnings,
  };
}
