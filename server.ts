import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Body parser with 50mb limit for high-res PNG, JPG and PDF documents
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Persistence directory
const DATA_DIR = path.resolve(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const EXPEDIENTES_FILE = path.join(DATA_DIR, 'expedientes.json');
const LOTES_FILE = path.join(DATA_DIR, 'lotes.json');
const ADMIN_FILE = path.join(DATA_DIR, 'admin.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper: extract exact MIME type and raw Base64 string from data URI
function extractMimeAndBase64(dataUriOrRaw: string): { mimeType: string; base64: string } {
  if (!dataUriOrRaw) return { mimeType: 'image/jpeg', base64: '' };
  const trimmed = dataUriOrRaw.trim();
  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
  if (match) {
    let mime = match[1].toLowerCase().trim();
    if (mime === 'image/jpg') mime = 'image/jpeg';
    // Clean any accidental whitespace inside base64 payload
    const base64Clean = match[2].replace(/\s+/g, '');
    return { mimeType: mime, base64: base64Clean };
  }
  // If raw base64 without prefix
  const clean = trimmed.replace(/\s+/g, '');
  return { mimeType: 'image/jpeg', base64: clean };
}

// CrediMóvil Official Document Checklist generator
export function getCredimovilDefaultDocs(esLegalizado: boolean = false) {
  const docs = [
    // 1. Documentación Básica (Todos los Vehículos) - Checklist CrediMóvil
    {
      id: 'doc-factura',
      categoria: 'VEHICULO_BASICA',
      tipo: 'FACTURA',
      nombre: 'Factura Original del Vehículo',
      descripcion: 'Debe presentarse la factura original correspondiente legible.',
      requerido: true,
      estatus: 'PENDIENTE',
    },
    {
      id: 'doc-consecutivos',
      categoria: 'VEHICULO_BASICA',
      tipo: 'CONSECUTIVOS_FACTURA',
      nombre: 'Consecutivos de Factura',
      descripcion: 'Todas las facturas consecutivas. Incluir la cadena completa de facturación.',
      requerido: true,
      estatus: 'PENDIENTE',
    },
    {
      id: 'doc-endosos',
      categoria: 'VEHICULO_BASICA',
      tipo: 'ENDOSOS',
      nombre: 'Endosos de las Facturas',
      descripcion: 'Endosos de las facturas en caso de existir, acompañando a los consecutivos correspondientes.',
      requerido: false,
      estatus: 'PENDIENTE',
    },
    {
      id: 'doc-refrendos',
      categoria: 'VEHICULO_BASICA',
      tipo: 'REFRENDO_TENENCIA',
      nombre: 'Refrendo / Tenencia (Últimos 5 Años)',
      descripcion: 'Comprobantes de pago de refrendo y tenencia de los últimos 5 años.',
      requerido: true,
      estatus: 'PENDIENTE',
    },

    // 2. Inicio de Crédito (CrediMóvil)
    {
      id: 'doc-ingresos',
      categoria: 'INICIO_CREDITO',
      tipo: 'COMPROBANTES_INGRESOS',
      nombre: 'Comprobantes de Ingresos (3 Meses)',
      descripcion: 'Últimos 3 meses de nómina, estados de cuenta bancarios o recibos de honorarios.',
      requerido: true,
      estatus: 'PENDIENTE',
    },
    {
      id: 'doc-domicilio',
      categoria: 'INICIO_CREDITO',
      tipo: 'COMPROBANTE_DOMICILIO',
      nombre: 'Comprobante de Domicilio (Agua o Luz)',
      descripcion: 'Recibo oficial de agua o luz con antigüedad no mayor a 3 meses.',
      requerido: true,
      estatus: 'PENDIENTE',
    },

    // 3. Fondeo y Pago al Lote
    {
      id: 'doc-clabe-lote',
      categoria: 'PAGO_FONDEO',
      tipo: 'CARATULA_BANCARIA_LOTE',
      nombre: 'Carátula Bancaria del Lote (CLABE)',
      descripcion: 'Estado de cuenta oficial del lote con CLABE interbancaria para la transferencia de fondeo.',
      requerido: true,
      estatus: 'PENDIENTE',
    },

    // 4. Documentación Adicional (Solo si el vehículo es legalizado)
    {
      id: 'doc-titulo',
      categoria: 'VEHICULO_LEGALIZADO',
      tipo: 'TITULO_PROPIEDAD',
      nombre: 'Título de Propiedad',
      descripcion: 'Título de propiedad (aplica únicamente para vehículos legalizados).',
      requerido: esLegalizado,
      estatus: 'PENDIENTE',
    },
    {
      id: 'doc-pedimento',
      categoria: 'VEHICULO_LEGALIZADO',
      tipo: 'PEDIMENTO_IMPORTACION',
      nombre: 'Pedimento de Importación',
      descripcion: 'Pedimento oficial de importación (aplica únicamente para vehículos legalizados).',
      requerido: esLegalizado,
      estatus: 'PENDIENTE',
    },
    {
      id: 'doc-factura-importadora',
      categoria: 'VEHICULO_LEGALIZADO',
      tipo: 'FACTURA_IMPORTADORA',
      nombre: 'Factura de Importadora',
      descripcion: 'Factura emitida por la importadora (incluir todos los consecutivos).',
      requerido: esLegalizado,
      estatus: 'PENDIENTE',
    },
    {
      id: 'doc-consecutivos-importadora',
      categoria: 'VEHICULO_LEGALIZADO',
      tipo: 'CONSECUTIVOS_IMPORTADORA',
      nombre: 'Consecutivos de Importadora',
      descripcion: 'Cadena de facturas de la importadora (presentar la documentación completa).',
      requerido: esLegalizado,
      estatus: 'PENDIENTE',
    },
    {
      id: 'doc-pagos-legalizacion',
      categoria: 'VEHICULO_LEGALIZADO',
      tipo: 'PAGOS_LEGALIZACION',
      nombre: 'Comprobantes de Pagos de Legalización',
      descripcion: 'Comprobantes de pago de legalización según la fecha en que se realizó.',
      requerido: esLegalizado,
      estatus: 'PENDIENTE',
    },
  ];

  return docs;
}

// Initial Dealerships
const DEFAULT_LOTES = [
  {
    id: 'lote-1',
    nombre: 'Lote Automotriz San Jerónimo',
    contacto: 'Lic. Roberto Garza',
    telefono: '811-234-5678',
    correo: 'ventas@sanjeronimoautos.com',
    direccion: 'Av. Gonzalitos #1450',
    ciudad: 'Monterrey, N.L.',
    cuentaClabeDefault: '',
    bancoDefault: '',
  },
  {
    id: 'lote-2',
    nombre: 'Seminuevos Cumbres Premier',
    contacto: 'Ing. Carlos Mendoza',
    telefono: '818-765-4321',
    correo: 'gerencia@cumbrespremier.mx',
    direccion: 'Paseo de los Leones #2300',
    ciudad: 'Monterrey, N.L.',
    cuentaClabeDefault: '',
    bancoDefault: '',
  },
  {
    id: 'lote-3',
    nombre: 'CarPoint Linda Vista',
    contacto: 'Ana Laura Peña',
    telefono: '812-445-9988',
    correo: 'creditos@carpointlv.com',
    direccion: 'Av. Miguel Alemán #310',
    ciudad: 'Guadalupe, N.L.',
    cuentaClabeDefault: '',
    bancoDefault: '',
  },
];

// Helper: read/write JSON safely
function readJson(filePath: string, fallback: any) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf-8');
      return fallback;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return fallback;
  }
}

function writeJson(filePath: string, data: any) {
  try {
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

function sanitizeFileName(name: string = 'documento') {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base || 'documento';
}

function fileExtensionFromMime(mimeType: string, originalName = '') {
  const lowerMime = (mimeType || '').toLowerCase();
  if (lowerMime === 'application/pdf') return 'pdf';
  if (lowerMime === 'image/png') return 'png';
  if (lowerMime === 'image/webp') return 'webp';
  if (lowerMime === 'image/jpeg' || lowerMime === 'image/jpg') return 'jpg';
  const ext = path.extname(originalName).replace('.', '').toLowerCase();
  return ['pdf', 'png', 'jpg', 'jpeg', 'webp'].includes(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : 'bin';
}

function saveDataUriAsFile(expedienteId: string, slot: string, dataUri: string, originalName = '') {
  if (!dataUri || typeof dataUri !== 'string' || !dataUri.startsWith('data:')) return dataUri;

  const { mimeType, base64 } = extractMimeAndBase64(dataUri);
  if (!base64) throw new Error(`Documento vacío para ${slot}`);

  const ext = fileExtensionFromMime(mimeType, originalName);
  const safeOriginal = sanitizeFileName(originalName || `${slot}.${ext}`);
  const timestamp = Date.now();
  const finalName = `${slot}-${timestamp}-${safeOriginal}`.slice(0, 180);
  const expDir = path.join(UPLOADS_DIR, sanitizeFileName(expedienteId));
  fs.mkdirSync(expDir, { recursive: true });
  const absolutePath = path.join(expDir, finalName);
  fs.writeFileSync(absolutePath, Buffer.from(base64, 'base64'));

  return `/api/expedientes/${encodeURIComponent(expedienteId)}/documentos/${encodeURIComponent(finalName)}`;
}

function isDataUri(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

function persistExpedienteDocuments(exp: any) {
  let changed = false;

  if (isDataUri(exp.fotoIneFrente)) {
    exp.fotoIneFrente = saveDataUriAsFile(exp.id, 'ine-frente', exp.fotoIneFrente, 'INE_Frente.jpg');
    changed = true;
  }
  if (isDataUri(exp.fotoIneReverso)) {
    exp.fotoIneReverso = saveDataUriAsFile(exp.id, 'ine-reverso', exp.fotoIneReverso, 'INE_Reverso.jpg');
    changed = true;
  }
  if (isDataUri(exp.comprobanteDomicilioActualUrl)) {
    exp.comprobanteDomicilioActualUrl = saveDataUriAsFile(exp.id, 'comprobante-domicilio', exp.comprobanteDomicilioActualUrl, exp.comprobanteDomicilioActualNombre || 'Comprobante_Domicilio.pdf');
    changed = true;
  }

  const ec = exp.estadosCuenta || {};
  for (const key of ['mes1Url', 'mes2Url', 'mes3Url', 'archivoConsolidadoUrl']) {
    if (isDataUri(ec[key])) {
      const nameKey = key.replace(/Url$/, 'Nombre');
      ec[key] = saveDataUriAsFile(exp.id, key.replace(/Url$/, ''), ec[key], ec[nameKey] || `${key}.pdf`);
      changed = true;
    }
  }
  exp.estadosCuenta = ec;

  for (const doc of exp.documentosFondeo || []) {
    if (isDataUri(doc.archivoUrl)) {
      doc.archivoUrl = saveDataUriAsFile(exp.id, `doc-${doc.id}`, doc.archivoUrl, doc.archivoNombre || doc.id);
      changed = true;
    }
  }

  return changed;
}

function persistIncomingDocument(expedienteId: string, dataUriOrUrl: string, slot: string, originalName = '') {
  if (!dataUriOrUrl) return '';
  if (isDataUri(dataUriOrUrl)) return saveDataUriAsFile(expedienteId, slot, dataUriOrUrl, originalName);
  return dataUriOrUrl;
}

// Initialize clean data
function initializeData() {
  if (!fs.existsSync(LOTES_FILE)) {
    writeJson(LOTES_FILE, DEFAULT_LOTES);
  }
  // expedientes.json starts clean with zero fake records
  if (!fs.existsSync(EXPEDIENTES_FILE)) {
    writeJson(EXPEDIENTES_FILE, []);
  }
  if (!fs.existsSync(ADMIN_FILE)) {
    writeJson(ADMIN_FILE, {
      pin: '1234',
      asesorNombre: 'Asesor CrediMóvil',
      telefonoContacto: '',
      correoNotificaciones: '',
    });
  }
}
initializeData();

// API ROUTES

// 1. Health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    name: 'CrediMóvil OCR & Fondeo API',
  });
});

// 2. Admin Auth
app.post('/api/admin/auth', (req, res) => {
  const { pin } = req.body;
  const admin = readJson(ADMIN_FILE, { pin: '1234' });
  if (pin === admin.pin) {
    res.json({
      success: true,
      token: `token_${Date.now()}_auth`,
      admin: {
        nombre: admin.asesorNombre || 'Asesor CrediMóvil',
        correo: admin.correoNotificaciones,
      },
    });
  } else {
    res.status(401).json({ success: false, message: 'PIN de asesor incorrecto. (PIN inicial: 1234)' });
  }
});

app.post('/api/admin/change-pin', (req, res) => {
  const { currentPin, newPin, asesorNombre, telefonoContacto, correoNotificaciones } = req.body;
  const admin = readJson(ADMIN_FILE, { pin: '1234' });

  if (currentPin !== admin.pin) {
    return res.status(401).json({ success: false, message: 'El PIN actual no coincide.' });
  }
  if (newPin && newPin.length < 4) {
    return res.status(400).json({ success: false, message: 'El nuevo PIN debe tener al menos 4 caracteres.' });
  }

  const updatedAdmin = {
    ...admin,
    pin: newPin || admin.pin,
    asesorNombre: asesorNombre || admin.asesorNombre,
    telefonoContacto: telefonoContacto || admin.telefonoContacto,
    correoNotificaciones: correoNotificaciones || admin.correoNotificaciones,
  };
  writeJson(ADMIN_FILE, updatedAdmin);
  res.json({ success: true, message: 'Configuración de CrediMóvil actualizada.' });
});

// Helper: Sleep utility for exponential backoff
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: Call Gemini models with multi-model fallback and backoff retry for 503 / 429
async function callGeminiWithResilience(
  parts: any[],
  purpose: string
): Promise<string> {
  // Ordered by speed, quota availability, and multimodal OCR accuracy
  const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  for (const modelName of candidateModels) {
    // Attempt up to 2 times per candidate model in case of temporary 503 or 429 spike
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[CrediMóvil OCR - ${purpose}] Trying model ${modelName} (attempt ${attempt})...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: { parts },
          config: {
            responseMimeType: 'application/json',
          },
        });

        if (response && response.text) {
          console.log(`[CrediMóvil OCR - ${purpose}] Success with ${modelName}`);
          return response.text;
        }
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err);
        const code = err?.status || err?.code;
        const isTemporary =
          code === 503 ||
          code === 429 ||
          msg.includes('503') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('high demand') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('rate limit');

        console.warn(`[CrediMóvil OCR - ${purpose}] ${modelName} attempt ${attempt} warning: ${msg.slice(0, 160)}`);

        if (isTemporary && attempt === 1) {
          // Wait 1200ms before retrying same model
          await sleep(1200);
          continue;
        }
        // Move to the next candidate model
        break;
      }
    }
  }

  throw lastError || new Error('Modelos de IA temporalmente ocupados por alta demanda');
}

// 3. OCR de Credencial INE CrediMóvil con Gemini Multimodal
app.post('/api/ocr-ine', async (req, res) => {
  try {
    const { imageBase64, imageBackBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere la imagen frontal de la credencial INE/IFE.',
      });
    }

    const frontData = extractMimeAndBase64(imageBase64);
    if (!frontData.base64) {
      return res.status(400).json({
        success: false,
        message: 'La imagen frontal de la credencial no contiene datos válidos.',
      });
    }

    const parts: any[] = [
      {
        inlineData: {
          mimeType: frontData.mimeType,
          data: frontData.base64,
        },
      },
    ];

    if (imageBackBase64) {
      const backData = extractMimeAndBase64(imageBackBase64);
      if (backData.base64) {
        parts.push({
          inlineData: {
            mimeType: backData.mimeType,
            data: backData.base64,
          },
        });
      }
    }

    const promptText = `Eres el sistema especializado de OCR de "CrediMóvil" para Credenciales para Votar del Instituto Nacional Electoral (INE) o IFE de México para trámites de crédito automotriz.

Analiza minuciosamente la imagen o documento de la credencial INE/IFE adjunta.
Extrae con la máxima exactitud todos los campos visibles en formato JSON estricto:

{
  "nombre": "Nombres de pila de la persona (ej. JUAN CARLOS)",
  "primerApellido": "Primer apellido / Paterno (ej. TREVIÑO)",
  "segundoApellido": "Segundo apellido / Materno (ej. GARCIA)",
  "nombreCompleto": "Nombre completo en orden: NOMBRES PRIMER_APELLIDO SEGUNDO_APELLIDO",
  "curp": "CURP de 18 caracteres exactos (ej. TEGM850412HNLRLG05)",
  "rfc": "RFC del cliente (10 caracteres base: 4 letras + 6 números de fecha YYMMDD tomados del CURP, o 13 caracteres si incluye homoclave)",
  "fechaNacimiento": "Fecha de nacimiento en formato YYYY-MM-DD",
  "sexo": "H si es Hombre/Masculino, M si es Mujer/Femenino, X si no binario",
  "edad": edad numérica aproximada calculada al año corriente,
  "domicilio": {
    "calle": "Nombre de la calle",
    "numExterior": "Número exterior",
    "numInterior": "Número interior si existe, sino vacío",
    "colonia": "Nombre de la colonia o fraccionamiento",
    "codigoPostal": "Código postal de 5 dígitos",
    "municipio": "Municipio o Alcaldía",
    "estado": "Entidad federativa (ej. NUEVO LEON, JALISCO, CDMX, etc.)",
    "domicilioCompleto": "Calle #NumExt Int, Colonia, CP, Municipio, Estado"
  },
  "vigencia": {
    "emision": "Año de emisión de la credencial (ej. 2022)",
    "vigenciaHasta": "Año de vigencia hasta (ej. 2032)",
    "seccion": "Sección electoral de 4 dígitos (ej. 1428)"
  },
  "ocrCic": "Código CIC u OCR si es visible",
  "tipoCredencial": "Tipo o modelo detectado (ej. INE Modelo G, INE Modelo F, INE Modelo E, IFE)",
  "calidadImagen": "BUENA, ACEPTABLE o BORROSA",
  "observaciones": ["lista de notas o validaciones, ej: 'Credencial vigente hasta 2032'"]
}

Reglas:
- Si algún dato no es legible por sombra o desenfoque, deja el campo como string vacío.
- Extrae el RFC del cliente. En México, los primeros 10 dígitos del RFC son exactamente iguales a los primeros 10 dígitos del CURP (4 letras + 6 dígitos de fecha).
- Devuelve EXCLUSIVAMENTE el JSON válido.`;

    parts.push({ text: promptText });

    const responseText = await callGeminiWithResilience(parts, 'INE');

    let parsedData: any = {};
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleaned);
    }

    // Ensure RFC is auto-generated if missing or incomplete
    if ((!parsedData.rfc || parsedData.rfc.length < 10) && parsedData.curp && parsedData.curp.length >= 10) {
      parsedData.rfc = parsedData.curp.substring(0, 10).toUpperCase();
    }

    res.json({
      success: true,
      data: parsedData,
      message: 'OCR de INE procesado exitosamente por CrediMóvil',
    });
  } catch (error: any) {
    console.error('OCR Error:', error);
    const msg = String(error?.message || error);
    const isHighDemand =
      error?.status === 503 ||
      error?.code === 503 ||
      msg.includes('503') ||
      msg.includes('UNAVAILABLE') ||
      msg.includes('high demand') ||
      msg.includes('RESOURCE_EXHAUSTED');

    res.status(isHighDemand ? 503 : 500).json({
      success: false,
      isHighDemand,
      message: isHighDemand
        ? 'Los servidores de IA están experimentando alta demanda momentánea. Por favor haz clic en "Reintentar CrediMóvil OCR".'
        : (error?.message || 'Error al procesar la credencial INE con OCR. Verifica que la imagen sea legible.'),
    });
  }
});

// 3.1 OCR de Comprobante de Domicilio (Recibo CFE / Luz o Agua)
app.post('/api/ocr-comprobante-domicilio', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere la imagen o PDF del comprobante de domicilio (CFE o Agua).',
      });
    }

    const docData = extractMimeAndBase64(imageBase64);
    if (!docData.base64) {
      return res.status(400).json({
        success: false,
        message: 'El comprobante de domicilio no contiene datos válidos.',
      });
    }

    const parts: any[] = [
      {
        inlineData: {
          mimeType: docData.mimeType,
          data: docData.base64,
        },
      },
    ];

    const promptText = `Eres el sistema especializado de OCR de "CrediMóvil" para comprobantes de domicilio oficiales en México (Recibo de Luz CFE / Comisión Federal de Electricidad o Recibo de Agua y Drenaje / Potable / Servicios de Agua).

Analiza minuciosamente el recibo de servicio adjunto y extrae con máxima precisión la dirección del inmueble y los datos del servicio en formato JSON estricto:

{
  "tipoComprobante": "CFE_LUZ" o "AGUA" o "OTRO",
  "companiaEmisora": "ej. CFE Suministrador de Servicios Básicos o Servicios de Agua y Drenaje de Monterrey o SIAPA",
  "nombreTitular": "Nombre completo que aparece como titular en el recibo",
  "fechaEmision": "Fecha o período de facturación visible (ej. Agosto 2026)",
  "esReciente": true si el recibo tiene una fecha o período menor a 90 días, sino false,
  "calle": "Nombre de la calle",
  "numExterior": "Número exterior del domicilio",
  "numInterior": "Número interior o departamento si existe, sino vacío",
  "colonia": "Nombre de la colonia o fraccionamiento",
  "codigoPostal": "Código postal mexicano de 5 dígitos",
  "municipio": "Municipio o Alcaldía",
  "estado": "Entidad federativa (ej. NUEVO LEON, JALISCO, CDMX, PUEBLA, etc.)",
  "domicilioCompleto": "Dirección completa concatenada: Calle #NumExt Int, Colonia, CP, Municipio, Estado"
}

Reglas:
- Si un campo no es visible, déjalo como string vacío.
- Valida que el código postal sea de 5 dígitos.
- Identifica correctamente si es CFE (Luz) o Agua.
- Devuelve EXCLUSIVAMENTE el JSON válido.`;

    parts.push({ text: promptText });

    const responseText = await callGeminiWithResilience(parts, 'COMPROBANTE_DOMICILIO');

    let parsedData: any = {};
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleaned);
    }

    res.json({
      success: true,
      data: parsedData,
      message: 'Comprobante de domicilio procesado con éxito por CrediMóvil OCR',
    });
  } catch (error: any) {
    console.error('OCR Domicilio Error:', error);
    const msg = String(error?.message || error);
    const isHighDemand =
      error?.status === 503 ||
      error?.code === 503 ||
      msg.includes('503') ||
      msg.includes('UNAVAILABLE') ||
      msg.includes('high demand') ||
      msg.includes('RESOURCE_EXHAUSTED');

    res.status(isHighDemand ? 503 : 500).json({
      success: false,
      isHighDemand,
      message: isHighDemand
        ? 'Los servidores de IA están experimentando alta demanda momentánea. Por favor haz clic en "Reintentar Escaneo de Comprobante".'
        : (error?.message || 'Error al procesar el comprobante de domicilio con OCR.'),
    });
  }
});

// 4. Lotes de Autos
app.get('/api/lotes', (req, res) => {
  const lotes = readJson(LOTES_FILE, DEFAULT_LOTES);
  const expedientes = readJson(EXPEDIENTES_FILE, []);

  const lotesWithStats = lotes.map((l: any) => {
    const exps = expedientes.filter((e: any) => e.loteId === l.id || e.loteNombre === l.nombre);
    const fondeados = exps.filter((e: any) => e.estatus === 'FONDEADO').length;
    return {
      ...l,
      totalExpedientes: exps.length,
      totalFondeados: fondeados,
    };
  });

  res.json({ success: true, lotes: lotesWithStats });
});

app.post('/api/lotes', (req, res) => {
  const { nombre, contacto, telefono, correo, direccion, ciudad, cuentaClabeDefault, bancoDefault } = req.body;
  if (!nombre) {
    return res.status(400).json({ success: false, message: 'El nombre del lote es obligatorio.' });
  }

  const lotes = readJson(LOTES_FILE, DEFAULT_LOTES);
  const newLote = {
    id: `lote-${Date.now()}`,
    nombre,
    contacto: contacto || '',
    telefono: telefono || '',
    correo: correo || '',
    direccion: direccion || '',
    ciudad: ciudad || 'México',
    cuentaClabeDefault: cuentaClabeDefault || '',
    bancoDefault: bancoDefault || '',
  };

  lotes.push(newLote);
  writeJson(LOTES_FILE, lotes);
  res.json({ success: true, lote: newLote, message: 'Lote registrado con éxito.' });
});

// Securely serve persisted expedition documents. Files never live inside expedientes.json.
app.get('/api/expedientes/:id/documentos/:filename', (req, res) => {
  const expedienteId = sanitizeFileName(req.params.id);
  const filename = sanitizeFileName(req.params.filename);
  const expDir = path.join(UPLOADS_DIR, expedienteId);
  const filePath = path.join(expDir, filename);

  if (!filePath.startsWith(expDir + path.sep) || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'Documento no encontrado.' });
  }

  res.sendFile(filePath);
});

// 5. Expedientes (CRUD)
app.get('/api/expedientes', (req, res) => {
  const { q, estatus, loteId } = req.query;
  let list = readJson(EXPEDIENTES_FILE, []);
  let migrated = false;
  for (const exp of list) migrated = persistExpedienteDocuments(exp) || migrated;
  if (migrated) writeJson(EXPEDIENTES_FILE, list);

  if (estatus && typeof estatus === 'string' && estatus !== 'TODOS') {
    list = list.filter((e: any) => e.estatus === estatus);
  }

  if (loteId && typeof loteId === 'string' && loteId !== 'TODOS') {
    list = list.filter((e: any) => e.loteId === loteId);
  }

  if (q && typeof q === 'string') {
    const query = q.toLowerCase().trim();
    list = list.filter((e: any) => {
      const nombre = (e.ine?.nombreCompleto || '').toLowerCase();
      const curp = (e.ine?.curp || '').toLowerCase();
      const rfc = (e.ine?.rfc || '').toLowerCase();
      const folio = (e.folio || '').toLowerCase();
      const lote = (e.loteNombre || '').toLowerCase();
      const auto = `${e.autoMarca || ''} ${e.autoModelo || ''}`.toLowerCase();
      return (
        nombre.includes(query) ||
        curp.includes(query) ||
        rfc.includes(query) ||
        folio.includes(query) ||
        lote.includes(query) ||
        auto.includes(query)
      );
    });
  }

  list.sort((a: any, b: any) => new Date(b.fechaActualizacion || b.fechaCreacion).getTime() - new Date(a.fechaActualizacion || a.fechaCreacion).getTime());

  res.json({ success: true, count: list.length, expedientes: list });
});

app.get('/api/expedientes/:id', (req, res) => {
  const expedientes = readJson(EXPEDIENTES_FILE, []);
  const item = expedientes.find((e: any) => e.id === req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });
  }
  if (persistExpedienteDocuments(item)) writeJson(EXPEDIENTES_FILE, expedientes);
  res.json({ success: true, expediente: item });
});

app.post('/api/expedientes/by-folio', (req, res) => {
  const { folio, pinFondeo } = req.body;
  if (!folio) {
    return res.status(400).json({ success: false, message: 'Debe ingresar el folio del expediente.' });
  }

  const expedientes = readJson(EXPEDIENTES_FILE, []);
  const item = expedientes.find(
    (e: any) => e.folio?.toUpperCase().trim() === folio.toUpperCase().trim()
  );

  if (!item) {
    return res.status(404).json({ success: false, message: 'No se encontró ningún expediente con ese folio.' });
  }

  if (pinFondeo && item.pinFondeo && pinFondeo.trim() !== item.pinFondeo.trim()) {
    return res.status(401).json({ success: false, message: 'PIN de acceso del lote incorrecto.' });
  }

  if (persistExpedienteDocuments(item)) writeJson(EXPEDIENTES_FILE, expedientes);
  res.json({ success: true, expediente: item });
});

app.post('/api/expedientes', (req, res) => {
  const expedientes = readJson(EXPEDIENTES_FILE, []);

  // Generate unique folio
  const nextNum = 1000 + expedientes.length + 1;
  const folio = `EXP-2026-${nextNum}`;
  const pinFondeo = Math.floor(1000 + Math.random() * 9000).toString();

  const body = req.body;
  const now = new Date().toISOString();
  const esLegalizado = Boolean(body.esVehiculoLegalizado);

  // Initialize CrediMóvil checklist
  const docsFondeo = getCredimovilDefaultDocs(esLegalizado);

  const newExpediente = {
    id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    folio,
    pinFondeo,
    fechaCreacion: now,
    fechaActualizacion: now,
    estatus: body.estatus || 'NUEVO',

    // 1. INE
    ine: body.ine || {},
    fotoIneFrente: '',
    fotoIneReverso: '',

    // 2. Comprobante de Domicilio
    domicilioCoincideConIne: body.domicilioCoincideConIne !== undefined ? Boolean(body.domicilioCoincideConIne) : true,
    comprobanteDomicilioActualUrl: '',
    comprobanteDomicilioActualNombre: body.comprobanteDomicilioActualNombre || '',
    tipoComprobanteDomicilio: body.tipoComprobanteDomicilio || 'CFE_LUZ',

    // 3. Estados de Cuenta de 3 meses para Análisis
    estadosCuenta: body.estadosCuenta || {},

    // 4. CrediMóvil Inicio de Crédito
    telefono: body.telefono || '',
    correo: body.correo || '',
    ingresoMensualAprox: Number(body.ingresoMensualAprox) || 0,
    tiempoViviendoDomicilio: body.tiempoViviendoDomicilio || '',
    casaPropiaORentada: body.casaPropiaORentada || '',
    tiempoEnTrabajo: body.tiempoEnTrabajo || '',
    nombreUbicacionEmpleo: body.nombreUbicacionEmpleo || '',
    giroActividadEmpresa: body.giroActividadEmpresa || '',
    dependientesEconomicos: Number(body.dependientesEconomicos) || 0,
    estadoCivil: body.estadoCivil || '',
    referenciasPersonales: body.referenciasPersonales || [],

    // 5. Lote
    loteId: body.loteId || '',
    loteNombre: body.loteNombre || 'Directo / Asesor',
    asesorLoteContacto: body.asesorLoteContacto || '',
    telefonoLote: body.telefonoLote || '',

    // 6. Vehículo
    autoMarca: body.autoMarca || '',
    autoModelo: body.autoModelo || '',
    autoAno: Number(body.autoAno) || new Date().getFullYear(),
    autoVersion: body.autoVersion || '',
    autoPrecio: Number(body.autoPrecio) || 0,
    autoVin: body.autoVin || '',
    esVehiculoLegalizado: esLegalizado,

    // 7. Términos
    enganche: Number(body.enganche) || 0,
    montoFinanciar: Number(body.montoFinanciar) || Math.max(0, (Number(body.autoPrecio) || 0) - (Number(body.enganche) || 0)),
    plazoMeses: Number(body.plazoMeses) || 48,
    tasaInteresAnual: Number(body.tasaInteresAnual) || 14.5,
    mensualidadEstimada: Number(body.mensualidadEstimada) || 0,
    financieraAsignada: body.financieraAsignada || 'CrediMóvil Auto',

    // 8. Checklist de Fondeo y Trámite
    documentosFondeo: (() => {
      const docs = body.documentosFondeo || docsFondeo;
      if (body.comprobanteDomicilioActualUrl) {
        const docDom = docs.find((d: any) => d.id === 'doc-domicilio');
        if (docDom) {
          docDom.estatus = 'SUBIDO';
          docDom.archivoUrl = body.comprobanteDomicilioActualUrl;
          docDom.archivoNombre = body.comprobanteDomicilioActualNombre || 'Comprobante_Domicilio_Agua_Luz';
          docDom.fechaSubida = now;
          docDom.subidoPor = 'Cliente / Solicitud Inicial';
        }
      }
      if (body.estadosCuenta) {
        const ec = body.estadosCuenta;
        const mainUrl = ec.archivoConsolidadoUrl || ec.mes1Url || ec.mes2Url || ec.mes3Url;
        const mainName = ec.archivoConsolidadoNombre || ec.mes1Nombre || 'Estados_de_Cuenta_3_Meses';
        if (mainUrl) {
          const docIng = docs.find((d: any) => d.id === 'doc-ingresos');
          if (docIng) {
            docIng.estatus = 'SUBIDO';
            docIng.archivoUrl = mainUrl;
            docIng.archivoNombre = mainName;
            docIng.fechaSubida = now;
            docIng.subidoPor = 'Cliente / Solicitud Inicial';
          }
        }
      }
      return docs;
    })(),
    cuentaClabeLote: body.cuentaClabeLote || '',
    bancoLote: body.bancoLote || '',
    notasAsesor: body.notasAsesor || 'Expediente registrado en CrediMóvil para análisis.',
  };

  // Persist uploaded files immediately and keep only stable URLs in JSON.
  newExpediente.fotoIneFrente = persistIncomingDocument(newExpediente.id, body.fotoIneFrente || '', 'ine-frente', 'INE_Frente.jpg');
  newExpediente.fotoIneReverso = persistIncomingDocument(newExpediente.id, body.fotoIneReverso || '', 'ine-reverso', 'INE_Reverso.jpg');
  newExpediente.comprobanteDomicilioActualUrl = persistIncomingDocument(newExpediente.id, body.comprobanteDomicilioActualUrl || '', 'comprobante-domicilio', newExpediente.comprobanteDomicilioActualNombre || 'Comprobante_Domicilio');

  for (const key of ['mes1Url', 'mes2Url', 'mes3Url', 'archivoConsolidadoUrl']) {
    const nameKey = key.replace(/Url$/, 'Nombre');
    if (newExpediente.estadosCuenta?.[key]) {
      newExpediente.estadosCuenta[key] = persistIncomingDocument(newExpediente.id, newExpediente.estadosCuenta[key], key.replace(/Url$/, ''), newExpediente.estadosCuenta[nameKey] || `${key}.pdf`);
    }
  }
  persistExpedienteDocuments(newExpediente);

  expedientes.unshift(newExpediente);
  writeJson(EXPEDIENTES_FILE, expedientes);

  res.status(201).json({
    success: true,
    message: 'Expediente guardado exitosamente en CrediMóvil.',
    expediente: newExpediente,
  });
});

app.put('/api/expedientes/:id', (req, res) => {
  const expedientes = readJson(EXPEDIENTES_FILE, []);
  const index = expedientes.findIndex((e: any) => e.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });
  }

  const existing = expedientes[index];
  const updated = {
    ...existing,
    ...req.body,
    id: existing.id,
    folio: existing.folio,
    pinFondeo: existing.pinFondeo,
    fechaActualizacion: new Date().toISOString(),
  };

  if (!updated.documentosFondeo || updated.documentosFondeo.length === 0) {
    updated.documentosFondeo = getCredimovilDefaultDocs(Boolean(updated.esVehiculoLegalizado));
  }

  // If any document arrives from a legacy client as base64, persist it before writing JSON.
  persistExpedienteDocuments(updated);

  expedientes[index] = updated;
  writeJson(EXPEDIENTES_FILE, expedientes);

  res.json({ success: true, expediente: updated, message: 'Expediente actualizado exitosamente.' });
});

app.delete('/api/expedientes/:id', (req, res) => {
  let expedientes = readJson(EXPEDIENTES_FILE, []);
  const initialLen = expedientes.length;
  expedientes = expedientes.filter((e: any) => e.id !== req.params.id);

  if (expedientes.length === initialLen) {
    return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });
  }

  writeJson(EXPEDIENTES_FILE, expedientes);
  const uploadDir = path.join(UPLOADS_DIR, sanitizeFileName(req.params.id));
  if (fs.existsSync(uploadDir)) fs.rmSync(uploadDir, { recursive: true, force: true });
  res.json({ success: true, message: 'Expediente eliminado con éxito.' });
});

// 6. Subida de Documentos (PNG, JPG, PDF)
app.post('/api/expedientes/:id/fondeo-doc', (req, res) => {
  const { docId, archivoUrl, archivoNombre, archivoTamano, subidoPor } = req.body;
  const expedientes = readJson(EXPEDIENTES_FILE, []);
  const exp = expedientes.find((e: any) => e.id === req.params.id);

  if (!exp) {
    return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });
  }

  if (!exp.documentosFondeo) {
    exp.documentosFondeo = getCredimovilDefaultDocs(Boolean(exp.esVehiculoLegalizado));
  }

  const doc = exp.documentosFondeo.find((d: any) => d.id === docId);
  if (!doc) {
    return res.status(404).json({ success: false, message: 'Tipo de documento no encontrado en el checklist.' });
  }

  // Detect type and persist the binary outside expedientes.json.
  let archivoTipo = 'imagen';
  if (archivoUrl?.startsWith('data:application/pdf') || /\.pdf(?:$|[?#])/i.test(archivoUrl || '')) {
    archivoTipo = 'pdf';
  } else if (archivoUrl?.startsWith('data:image/png') || /\.png(?:$|[?#])/i.test(archivoUrl || '')) {
    archivoTipo = 'png';
  } else if (archivoUrl?.startsWith('data:image/webp') || /\.webp(?:$|[?#])/i.test(archivoUrl || '')) {
    archivoTipo = 'webp';
  } else {
    archivoTipo = 'jpeg';
  }

  const persistedUrl = persistIncomingDocument(exp.id, archivoUrl, `doc-${docId}`, archivoNombre || docId);

  doc.estatus = 'SUBIDO';
  doc.archivoUrl = persistedUrl;
  doc.archivoNombre = archivoNombre;
  doc.archivoTipo = archivoTipo;
  doc.archivoTamano = archivoTamano || 'Cargado';
  doc.fechaSubida = new Date().toISOString();
  doc.subidoPor = subidoPor || exp.loteNombre || 'Lote de Autos';
  doc.observaciones = '';

  if (exp.estatus === 'APROBADO' || exp.estatus === 'FONDEO_PENDIENTE') {
    exp.estatus = 'FONDEO_REVISION';
  }
  exp.fechaActualizacion = new Date().toISOString();

  writeJson(EXPEDIENTES_FILE, expedientes);

  res.json({
    success: true,
    message: `Documento "${doc.nombre}" subido exitosamente en CrediMóvil.`,
    documentosFondeo: exp.documentosFondeo,
    expedienteEstatus: exp.estatus,
  });
});

// 7. Asesor aprueba o rechaza documento
app.put('/api/expedientes/:id/fondeo-doc-review', (req, res) => {
  const { docId, estatus, observaciones } = req.body;
  const expedientes = readJson(EXPEDIENTES_FILE, []);
  const exp = expedientes.find((e: any) => e.id === req.params.id);

  if (!exp) {
    return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });
  }

  const doc = exp.documentosFondeo?.find((d: any) => d.id === docId);
  if (!doc) {
    return res.status(404).json({ success: false, message: 'Documento no encontrado.' });
  }

  doc.estatus = estatus;
  doc.observaciones = observaciones || '';
  doc.fechaRevision = new Date().toISOString();

  exp.fechaActualizacion = new Date().toISOString();
  writeJson(EXPEDIENTES_FILE, expedientes);

  res.json({
    success: true,
    message: `Estatus del documento actualizado a ${estatus}.`,
    expediente: exp,
  });
});

// 8. Estadísticas
app.get('/api/stats', (req, res) => {
  const expedientes = readJson(EXPEDIENTES_FILE, []);

  const total = expedientes.length;
  const nuevos = expedientes.filter((e: any) => e.estatus === 'NUEVO').length;
  const enEvaluacion = expedientes.filter((e: any) => e.estatus === 'EN_EVALUACION').length;
  const aprobados = expedientes.filter((e: any) => e.estatus === 'APROBADO' || e.estatus === 'PRE_APROBADO').length;
  const fondeoRevision = expedientes.filter((e: any) => e.estatus === 'FONDEO_REVISION' || e.estatus === 'FONDEO_PENDIENTE').length;
  const fondeados = expedientes.filter((e: any) => e.estatus === 'FONDEADO').length;

  const montoTotalFinanciado = expedientes
    .filter((e: any) => e.estatus === 'FONDEADO' || e.estatus === 'APROBADO')
    .reduce((acc: number, curr: any) => acc + (Number(curr.montoFinanciar) || 0), 0);

  res.json({
    success: true,
    stats: {
      total,
      nuevos,
      enEvaluacion,
      aprobados,
      fondeoRevision,
      fondeados,
      montoTotalFinanciado,
    },
  });
});

// Dev Server & Static Files
function resolveDistPath() {
  const candidates = [
    path.resolve(__dirname, 'dist'),
    path.resolve(process.cwd(), 'dist'),
    path.resolve(__dirname, '..', 'dist'),
    path.resolve(process.cwd(), '..', 'dist'),
  ];

  const found = candidates.find((candidate) => fs.existsSync(path.join(candidate, 'index.html')));

  if (!found) {
    console.error('No se encontró dist/index.html. Rutas revisadas:', candidates);
    return candidates[0];
  }

  console.log('CrediMóvil frontend dist encontrado en:', found);
  return found;
}

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = resolveDistPath();
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CrediMóvil server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
