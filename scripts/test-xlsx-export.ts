import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createXlsxBuffer } from '../server/xlsx-export.ts';

const workbook = await createXlsxBuffer([
  { name: 'Resumen', rows: [['CrediMóvil'], ['Ingresos', 125.5]], widths: [30, 24] },
  {
    name: 'Ingresos',
    rows: [
      ['Fecha', 'Descripcion', 'Monto'],
      ['2026-10-01', '=1+1 & <texto>', 125.5],
    ],
    widths: [14, 48, 15],
  },
  { name: 'Egresos', rows: [['Tipo', 'Monto'], ['EGRESO', 42]] },
  { name: 'Movimientos', rows: [['Tipo', 'Monto'], ['INGRESO', 125.5]] },
]);

assert.ok(workbook.length > 100, 'El archivo XLSX generado debe tener contenido.');
assert.equal(workbook.subarray(0, 2).toString('ascii'), 'PK', 'El XLSX debe ser un ZIP válido.');

const tempDir = mkdtempSync(join(tmpdir(), 'credimovil-xlsx-'));
const filePath = join(tempDir, 'test.xlsx');
try {
  writeFileSync(filePath, workbook);
  const python = [
    'import sys, zipfile, xml.etree.ElementTree as ET',
    'path = sys.argv[1]',
    'ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}',
    'with zipfile.ZipFile(path) as z:',
    '    assert z.testzip() is None, "ZIP checksum validation failed"',
    '    for name in z.namelist():',
    '        if name.endswith(".xml") or name.endswith(".rels"):',
    '            ET.fromstring(z.read(name))',
    '    wb = ET.fromstring(z.read("xl/workbook.xml"))',
    '    sheet_names = [node.attrib["name"] for node in wb.findall("m:sheets/m:sheet", ns)]',
    '    assert sheet_names == ["Resumen", "Ingresos", "Egresos", "Movimientos"], sheet_names',
    '    sheet = ET.fromstring(z.read("xl/worksheets/sheet2.xml"))',
    '    suspicious = next((cell for cell in sheet.findall(".//m:c", ns) if cell.attrib.get("r") == "B2"), None)',
    '    assert suspicious is not None and suspicious.attrib.get("t") == "inlineStr", "Untrusted text must stay a string"',
    '    assert suspicious.find("m:f", ns) is None, "User data must never become a spreadsheet formula"',
    '    text = suspicious.find("m:is/m:t", ns)',
    '    assert text is not None and text.text == "=1+1 & <texto>", text.text if text is not None else None',
    '    amount = next((cell for cell in sheet.findall(".//m:c", ns) if cell.attrib.get("r") == "C2"), None)',
    '    assert amount is not None and amount.find("m:v", ns).text == "125.5"',
    'print("XLSX package structure and formula-safety checks passed")',
  ].join('\n');
  const result = spawnSync('python3', ['-c', python, filePath], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'XLSX validation failed');
  process.stdout.write(result.stdout);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
