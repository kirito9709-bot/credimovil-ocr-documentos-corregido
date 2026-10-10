import { ZipArchive } from 'archiver';

export function xmlEscape(value: unknown) {
  const safeText = String(value ?? '').split('').filter((character) => {
    const code = character.charCodeAt(0);
    return code === 9 || code === 10 || code === 13 || code >= 32;
  }).join('');
  return safeText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function excelColumnName(number: number) {
  let value = number;
  let name = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

// Generate a small XLSX workbook with inline strings. We only export trusted OCR
// analysis data; no uploaded workbook is parsed by this code path.
export function createWorksheetXml(rows: any[][], widths: number[] = []) {
  const colsXml = widths.length
    ? '<cols>' + widths.map((width, index) =>
        '<col min="' + (index + 1) + '" max="' + (index + 1) +
        '" width="' + Math.max(8, Math.min(80, Number(width) || 12)) + '" customWidth="1"/>'
      ).join('') + '</cols>'
    : '';

  const rowXml = rows.map((row, rowIndex) => {
    const cells = (Array.isArray(row) ? row : []).map((value, colIndex) => {
      if (value === null || value === undefined || value === '') return '';
      const reference = excelColumnName(colIndex + 1) + (rowIndex + 1);
      if (typeof value === 'number' && Number.isFinite(value)) {
        return '<c r="' + reference + '" t="n"><v>' + String(value) + '</v></c>';
      }
      const textValue = xmlEscape(value instanceof Date ? value.toISOString() : value);
      // Inline strings cannot be interpreted as formulas, preventing formula injection in exports.
      return '<c r="' + reference + '" t="inlineStr"><is><t xml:space="preserve">' + textValue + '</t></is></c>';
    }).join('');
    return '<row r="' + (rowIndex + 1) + '">' + cells + '</row>';
  }).join('');

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetFormatPr defaultRowHeight="15"/>' + colsXml + '<sheetData>' + rowXml + '</sheetData></worksheet>';
}

export async function createXlsxBuffer(sheets: Array<{ name: string; rows: any[][]; widths?: number[] }>) {
  return await new Promise<Buffer>((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on('data', (chunk: Buffer | Uint8Array) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    archive.on('error', reject);
    archive.on('end', () => resolve(Buffer.concat(chunks)));

    const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      sheets.map((_, index) => '<Override PartName="/xl/worksheets/sheet' + (index + 1) +
        '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') +
      '</Types>';

    const rootRelationships = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';

    const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      sheets.map((sheet, index) => '<sheet name="' + xmlEscape(sheet.name.slice(0, 31)) +
        '" sheetId="' + (index + 1) + '" r:id="rId' + (index + 1) + '"/>').join('') +
      '</sheets></workbook>';

    const workbookRelationships = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map((_, index) => '<Relationship Id="rId' + (index + 1) +
        '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ' +
        'Target="worksheets/sheet' + (index + 1) + '.xml"/>').join('') +
      '</Relationships>';

    archive.append(contentTypes, { name: '[Content_Types].xml' });
    archive.append(rootRelationships, { name: '_rels/.rels' });
    archive.append(workbook, { name: 'xl/workbook.xml' });
    archive.append(workbookRelationships, { name: 'xl/_rels/workbook.xml.rels' });
    sheets.forEach((sheet, index) => {
      archive.append(createWorksheetXml(sheet.rows, sheet.widths), { name: 'xl/worksheets/sheet' + (index + 1) + '.xml' });
    });
    archive.finalize().catch(reject);
  });
}
