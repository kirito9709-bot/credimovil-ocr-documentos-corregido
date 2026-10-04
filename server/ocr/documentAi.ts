import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

export interface DocumentAiTableRow {
  cells: string[];
  page: number;
}

export interface DocumentAiExtraction {
  provider: 'DOCUMENT_AI';
  processorName: string;
  text: string;
  tableRows: DocumentAiTableRow[];
  pageCount: number;
}

function getTextAnchorValue(document: any, textAnchor: any): string {
  const text = String(document?.text || '');
  const segments = Array.isArray(textAnchor?.textSegments) ? textAnchor.textSegments : [];
  if (!segments.length) return '';

  return segments.map((segment: any) => {
    const start = Number(segment?.startIndex || 0);
    const end = Number(segment?.endIndex || start);
    return text.slice(start, end);
  }).join('').replace(/\s+/g, ' ').trim();
}

function parseProcessorName() {
  const explicit = String(process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_NAME || '').trim();
  if (explicit) return explicit;

  const projectId = String(process.env.GOOGLE_CLOUD_PROJECT || '').trim();
  const location = String(process.env.GOOGLE_DOCUMENT_AI_LOCATION || 'us').trim();
  const processorId = String(process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID || '').trim();

  if (!projectId || !processorId) return '';
  return `projects/${projectId}/locations/${location}/processors/${processorId}`;
}

function getCredentials() {
  const raw = String(process.env.GOOGLE_DOCUMENT_AI_CREDENTIALS_JSON || '').trim();
  if (!raw) return undefined;

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error('GOOGLE_DOCUMENT_AI_CREDENTIALS_JSON no contiene JSON válido.');
  }
}

export function documentAiConfigured() {
  return Boolean(parseProcessorName());
}

export async function extractWithDocumentAi(
  buffer: Buffer,
  mimeType: string
): Promise<DocumentAiExtraction> {
  const processorName = parseProcessorName();
  if (!processorName) {
    throw new Error('Document AI no está configurado. Define GOOGLE_DOCUMENT_AI_PROCESSOR_NAME o GOOGLE_CLOUD_PROJECT + GOOGLE_DOCUMENT_AI_PROCESSOR_ID.');
  }

  const match = processorName.match(/locations\/([^/]+)/i);
  const location = match?.[1] || String(process.env.GOOGLE_DOCUMENT_AI_LOCATION || 'us');
  const credentials = getCredentials();

  const client = new DocumentProcessorServiceClient({
    apiEndpoint: `${location}-documentai.googleapis.com`,
    ...(credentials ? { credentials } : {}),
  });

  const [response] = await client.processDocument({
    name: processorName,
    rawDocument: {
      content: buffer.toString('base64'),
      mimeType,
    },
  });

  const document = response?.document;
  if (!document) throw new Error('Document AI no devolvió un documento procesado.');

  const tableRows: DocumentAiTableRow[] = [];
  for (let pageIndex = 0; pageIndex < (document.pages || []).length; pageIndex++) {
    const page = document.pages[pageIndex];
    for (const table of page.tables || []) {
      const headerRows = Array.isArray(table.headerRows) ? table.headerRows : [];
      const bodyRows = Array.isArray(table.bodyRows) ? table.bodyRows : [];

      for (const row of [...headerRows, ...bodyRows]) {
        const cells = (row.cells || []).map((cell: any) =>
          getTextAnchorValue(document, cell?.layout?.textAnchor)
        );
        if (cells.some(Boolean)) {
          tableRows.push({ cells, page: pageIndex + 1 });
        }
      }
    }
  }

  return {
    provider: 'DOCUMENT_AI',
    processorName,
    text: String(document.text || ''),
    tableRows,
    pageCount: Array.isArray(document.pages) ? document.pages.length : 0,
  };
}
