import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Parse JSON/form requests before any API route.
// Keep the limit high enough for document uploads sent as data URIs.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

function normalizeSupabaseUrl(raw: string) {
  const value = String(raw || '').trim();
  if (!value) return '';

  try {
    const url = new URL(value);
    // Supabase JS expects the project root URL, not /rest/v1, /auth/v1, etc.
    // Normalize common accidental suffixes entered in Render.
    return url.origin;
  } catch {
    return value
      .replace(/[\\/]+$/, '')
      .replace(/\/(?:rest|auth|storage)\/v1(?:\/.*)?$/i, '');
  }
}

const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL || '');
const SUPABASE_SECRET_KEY = (
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  ''
).trim();

const supabase = SUPABASE_URL && SUPABASE_SECRET_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const GEMINI_API_KEY = (
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  ''
).trim();

const ai = GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: GEMINI_API_KEY })
  : null;

function supabaseConfigured() {
  return Boolean(supabase);
}

const CREDIMOVIL_INTEREST_MONTHLY = 0.02;
const CREDIMOVIL_IVA_ON_INTEREST = 0.16;
const CREDIMOVIL_GPS_MONTHLY = 260;
const CREDIMOVIL_SDD_MONTHLY = 142;

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

// Based on the supplied GPI Auto Comercial quotes:
// capital monthly + 2.00% monthly interest + 16% IVA on interest + GPS $260 + SDD $142.
// The five supplied quotes are for 48 months and match this calculation to the cent.
function calculateCredimovilMonthlyPayment(montoFinanciar: number, plazoMeses: number) {
  const amount = Math.max(0, Number(montoFinanciar) || 0);
  const term = Math.max(1, Number(plazoMeses) || 48);
  if (!amount) return 0;

  const capitalMensual = roundMoney(amount / term);
  const interesMensual = roundMoney(amount * CREDIMOVIL_INTEREST_MONTHLY);
  const ivaInteres = roundMoney(interesMensual * CREDIMOVIL_IVA_ON_INTEREST);

  return roundMoney(
    capitalMensual +
    interesMensual +
    ivaInteres +
    CREDIMOVIL_GPS_MONTHLY +
    CREDIMOVIL_SDD_MONTHLY
  );
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const sessions = new Map<string, {
  username: string;
  role: 'admin' | 'asesor' | 'lote';
  nombre: string;
  loteId?: string;
  expiresAt: number;
}>();

function normalizeUsername(value: string = '') {
  return String(value).trim().toLowerCase();
}

function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedHex] = String(storedHash || '').split(':');
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

function safeEqualText(a: string, b: string) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function getBearerToken(req: any) {
  const value = String(req.headers.authorization || '');
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

function getSession(req: any) {
  const token = getBearerToken(req);
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { ...session, token };
}

function requireAuth(req: any, res: any) {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ success: false, message: 'Debes iniciar sesión para acceder a este recurso.' });
    return null;
  }
  return session;
}

function requireAdmin(req: any, res: any) {
  const session = requireAuth(req, res);
  if (!session) return null;
  if (session.role !== 'admin') {
    res.status(403).json({ success: false, message: 'Esta función requiere permisos de administrador.' });
    return null;
  }
  return session;
}

function requireStaff(req: any, res: any) {
  const session = requireAuth(req, res);
  if (!session) return null;
  if (session.role !== 'admin' && session.role !== 'asesor') {
    res.status(403).json({ success: false, message: 'Esta función es exclusiva del equipo CrediMóvil.' });
    return null;
  }
  return session;
}

function requireLote(req: any, res: any) {
  const session = requireAuth(req, res);
  if (!session) return null;
  if (session.role !== 'lote' || !session.loteId) {
    res.status(403).json({ success: false, message: 'Esta función es exclusiva del portal del lote.' });
    return null;
  }
  return session;
}

async function getExpedienteRowByIdOrFolio(identifier: string) {
  if (!supabase) throw new Error('Supabase no está configurado.');

  const value = String(identifier || '').trim();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  if (isUuid) {
    const byId = await supabase
      .from('expedientes')
      .select('id,folio,lote_id')
      .eq('id', value)
      .maybeSingle();

    if (byId.error) throw new Error(`Supabase expediente: ${byId.error.message}`);
    if (byId.data) return byId.data;
  }

  const byFolio = await supabase
    .from('expedientes')
    .select('id,folio,lote_id')
    .eq('folio', value.toUpperCase())
    .maybeSingle();

  if (byFolio.error) throw new Error(`Supabase expediente por folio: ${byFolio.error.message}`);
  if (byFolio.data) return byFolio.data;

  // Older records created before Supabase became the only source kept
  // the app's legacy id inside the JSON data column. Accept that id too.
  const byLegacyId = await supabase
    .from('expedientes')
    .select('id,folio,lote_id')
    .eq('data->>id', value)
    .maybeSingle();

  if (byLegacyId.error) {
    throw new Error(`Supabase expediente por id legado: ${byLegacyId.error.message}`);
  }

  return byLegacyId.data || null;
}

function canAccessLote(session: any, loteId: string) {
  return session?.role === 'admin' || session?.role === 'asesor' || (session?.role === 'lote' && session?.loteId === loteId);
}

async function findLoteUser(username: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('lote_usuarios')
    .select('id,nombre,username,password_hash,activo,lote_id')
    .eq('username', username)
    .maybeSingle();
  if (error) throw new Error(`Supabase usuarios de lote: ${error.message}`);
  return data || null;
}

async function supabaseLoteUserList() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('lote_usuarios')
    .select('id,nombre,username,activo,lote_id,created_at')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Supabase usuarios de lote: ${error.message}`);
  return data || [];
}

async function findAdvisor(username: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('asesores')
    .select('id,nombre,username,password_hash,activo,created_at')
    .eq('username', username)
    .maybeSingle();
  if (error) throw new Error(`Supabase asesores: ${error.message}`);
  return data || null;
}

async function supabaseAdvisorList() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('asesores')
    .select('id,nombre,username,activo,created_at')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Supabase asesores: ${error.message}`);
  return data || [];
}

function mapSupabaseLote(row: any) {
  return {
    id: row.id,
    nombre: row.nombre,
    contacto: row.contacto || '',
    telefono: row.telefono || '',
    correo: row.correo || '',
    direccion: row.direccion || '',
    ciudad: row.ciudad || 'México',
    cuentaClabeDefault: row.cuenta_clabe_default || '',
    bancoDefault: row.banco_default || '',
    activo: row.activo !== false,
    created_at: row.created_at,
  };
}

function extractMimeAndBase64(dataUriOrRaw: string): { mimeType: string; base64: string } {
  if (!dataUriOrRaw) return { mimeType: 'application/octet-stream', base64: '' };
  const trimmed = String(dataUriOrRaw).trim();
  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
  if (match) {
    let mimeType = match[1].toLowerCase().trim();
    if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
    return { mimeType, base64: match[2].replace(/\s+/g, '') };
  }
  return {
    mimeType: 'application/octet-stream',
    base64: trimmed.replace(/\s+/g, ''),
  };
}

function sanitizeFileName(name: string = 'documento') {
  const base = path.basename(String(name)).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base || 'documento';
}

function fileExtensionFromMime(mimeType: string, originalName = '') {
  const lowerMime = String(mimeType || '').toLowerCase();
  if (lowerMime === 'application/pdf') return 'pdf';
  if (lowerMime === 'image/png') return 'png';
  if (lowerMime === 'image/webp') return 'webp';
  if (lowerMime === 'image/jpeg' || lowerMime === 'image/jpg') return 'jpg';
  const ext = path.extname(originalName).replace('.', '').toLowerCase();
  return ['pdf', 'png', 'jpg', 'jpeg', 'webp'].includes(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : 'bin';
}

function isDataUri(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

function expedienteToSupabasePayload(exp: any) {
  const ine = exp?.ine || {};
  return {
    id: exp?.supabaseId || undefined,
    folio: String(exp?.folio || ''),
    pin_fondeo: String(exp?.pinFondeo || ''),
    estatus: String(exp?.estatus || 'NUEVO'),
    lote_id: typeof exp?.loteId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(exp.loteId) ? exp.loteId : null,
    asesor_id: null,
    cliente_nombre: String(ine?.nombreCompleto || ine?.nombre || ''),
    cliente_curp: String(ine?.curp || ''),
    cliente_rfc: String(ine?.rfc || ''),
    telefono: String(exp?.telefono || ''),
    correo: String(exp?.correo || ''),
    auto_marca: String(exp?.autoMarca || ''),
    auto_modelo: String(exp?.autoModelo || ''),
    auto_ano: Number(exp?.autoAno) || null,
    monto_financiar: Number(exp?.montoFinanciar) || 0,
    data: exp || {},
  };
}

const SUPABASE_BUCKET = 'credimovil-documentos';
const SIGNED_DOCUMENT_TTL_SECONDS = 60 * 60;

function cloneJson(value: any) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function stripDocumentValues(exp: any) {
  const copy = cloneJson(exp);
  copy.fotoIneFrente = '';
  copy.fotoIneReverso = '';
  copy.comprobanteDomicilioActualUrl = '';

  if (copy.estadosCuenta) {
    for (const key of ['mes1Url', 'mes2Url', 'mes3Url', 'archivoConsolidadoUrl']) {
      copy.estadosCuenta[key] = '';
    }
  }

  copy.documentosFondeo = (copy.documentosFondeo || []).map((doc: any) => ({
    ...doc,
    archivoUrl: '',
  }));

  return copy;
}

function documentTypeForStateKey(key: string) {
  const map: Record<string, string> = {
    mes1Url: 'ESTADO_CUENTA_MES1',
    mes2Url: 'ESTADO_CUENTA_MES2',
    mes3Url: 'ESTADO_CUENTA_MES3',
    archivoConsolidadoUrl: 'ESTADO_CUENTA_CONSOLIDADO',
  };
  return map[key] || key.toUpperCase();
}

function isSignedOrApiDocumentUrl(value: unknown) {
  return typeof value === 'string' && (
    value.startsWith('/api/expedientes/') ||
    value.includes('/storage/v1/object/') ||
    value.includes('accessToken=')
  );
}

async function getSupabaseExpedienteRowByFolio(folio: string) {
  if (!supabase) throw new Error('Supabase no está configurado.');

  const { data, error } = await supabase
    .from('expedientes')
    .select('id,folio,data')
    .eq('folio', folio)
    .maybeSingle();

  if (error) throw new Error(`Supabase expediente ${folio}: ${error.message}`);
  return data || null;
}

async function uploadDataUriToSupabase(
  dbExpedienteId: string,
  tipo: string,
  dataUri: string,
  originalName = '',
  estatus = 'SUBIDO',
  observaciones = '',
  metadata: Record<string, any> = {}
) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  if (!isDataUri(dataUri)) return null;

  const { mimeType, base64 } = extractMimeAndBase64(dataUri);
  if (!base64) throw new Error(`Documento vacío para ${tipo}`);

  const safeTipo = sanitizeFileName(tipo);
  const ext = fileExtensionFromMime(mimeType, originalName);
  const safeOriginal = sanitizeFileName(originalName || `${safeTipo}.${ext}`);
  const storagePath = `expedientes/${dbExpedienteId}/${safeTipo}-${Date.now()}-${safeOriginal}`;
  const bytes = Buffer.from(base64, 'base64');

  const { data: previous, error: previousError } = await supabase
    .from('documentos')
    .select('id,storage_path')
    .eq('expediente_id', dbExpedienteId)
    .eq('tipo', tipo)
    .maybeSingle();

  if (previousError) {
    throw new Error(`Supabase documento previo: ${previousError.message}`);
  }

  if (previous?.storage_path) {
    await supabase.storage.from(SUPABASE_BUCKET).remove([previous.storage_path]).catch(() => undefined);
  }

  const { error: uploadError } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(storagePath, bytes, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Supabase Storage ${tipo}: ${uploadError.message}`);
  }

  const { error: docError } = await supabase
    .from('documentos')
    .upsert({
      ...(previous?.id ? { id: previous.id } : {}),
      expediente_id: dbExpedienteId,
      tipo,
      nombre: safeOriginal,
      storage_path: storagePath,
      mime_type: mimeType,
      tamano: bytes.length,
      estatus,
      observaciones,
      subido_por: null,
      metadata,
    }, {
      onConflict: 'expediente_id,tipo',
    });

  if (docError) {
    await supabase.storage.from(SUPABASE_BUCKET).remove([storagePath]).catch(() => undefined);
    throw new Error(`Supabase metadata ${tipo}: ${docError.message}`);
  }

  return storagePath;
}

async function createSignedStorageUrl(storagePath: string) {
  if (!supabase || !storagePath) return '';
  const { data, error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_DOCUMENT_TTL_SECONDS);

  if (error) {
    console.warn(`No se pudo firmar ${storagePath}:`, error.message);
    return '';
  }

  return data?.signedUrl || '';
}

async function storeExpedienteDocuments(exp: any, dbExpedienteId: string) {
  const working = cloneJson(exp);

  const topLevelDocuments: Array<[string, string, string, string]> = [
    ['fotoIneFrente', 'INE_FRENTE', 'INE_Frente.jpg', working.fotoIneFrente],
    ['fotoIneReverso', 'INE_REVERSO', 'INE_Reverso.jpg', working.fotoIneReverso],
    ['comprobanteDomicilioActualUrl', 'COMPROBANTE_DOMICILIO', working.comprobanteDomicilioActualNombre || 'Comprobante_Domicilio', working.comprobanteDomicilioActualUrl],
  ];

  for (const [field, tipo, fallbackName, value] of topLevelDocuments) {
    if (isDataUri(value)) {
      await uploadDataUriToSupabase(
        dbExpedienteId,
        tipo,
        value,
        field === 'comprobanteDomicilioActualUrl' ? (working.comprobanteDomicilioActualNombre || fallbackName) : fallbackName
      );
      working[field] = '';
    } else if (isSignedOrApiDocumentUrl(value)) {
      working[field] = '';
    }
  }

  if (working.estadosCuenta) {
    for (const key of ['mes1Url', 'mes2Url', 'mes3Url', 'archivoConsolidadoUrl']) {
      const value = working.estadosCuenta[key];
      if (isDataUri(value)) {
        const nameKey = key.replace(/Url$/, 'Nombre');
        await uploadDataUriToSupabase(
          dbExpedienteId,
          documentTypeForStateKey(key),
          value,
          working.estadosCuenta[nameKey] || key,
          'SUBIDO',
          '',
          { origen: 'Solicitud inicial', fechaSubida: new Date().toISOString() }
        );
        working.estadosCuenta[key] = '';
      } else if (isSignedOrApiDocumentUrl(value)) {
        working.estadosCuenta[key] = '';
      }
    }
  }

  working.documentosFondeo = (working.documentosFondeo || []).map((doc: any) => ({ ...doc, archivoUrl: doc.archivoUrl || '' }));
  for (const doc of working.documentosFondeo) {
    if (isDataUri(doc.archivoUrl)) {
      await uploadDataUriToSupabase(
        dbExpedienteId,
        `FONDEO_${doc.id}`,
        doc.archivoUrl,
        doc.archivoNombre || doc.id,
        doc.estatus || 'SUBIDO',
        doc.observaciones || '',
        {
          subidoPor: doc.subidoPor || '',
          fechaSubida: doc.fechaSubida || new Date().toISOString(),
        }
      );
      doc.archivoUrl = '';
    } else if (isSignedOrApiDocumentUrl(doc.archivoUrl)) {
      doc.archivoUrl = '';
    }
  }

  return stripDocumentValues(working);
}

function applyStoredDocumentsToExpediente(exp: any, documentRows: any[]) {
  const result = cloneJson(exp);
  const byType = new Map<string, any>();

  for (const row of documentRows || []) {
    byType.set(row.tipo, row);
  }

  const signedCache = new Map<string, string>();
  const loadUrl = async (row?: any) => {
    if (!row?.storage_path) return '';
    if (!signedCache.has(row.storage_path)) {
      signedCache.set(row.storage_path, await createSignedStorageUrl(row.storage_path));
    }
    return signedCache.get(row.storage_path) || '';
  };

  return (async () => {
    result.fotoIneFrente = await loadUrl(byType.get('INE_FRENTE'));
    result.fotoIneReverso = await loadUrl(byType.get('INE_REVERSO'));
    result.comprobanteDomicilioActualUrl = await loadUrl(byType.get('COMPROBANTE_DOMICILIO'));

    if (!result.estadosCuenta) result.estadosCuenta = {};
    for (const key of ['mes1Url', 'mes2Url', 'mes3Url', 'archivoConsolidadoUrl']) {
      result.estadosCuenta[key] = await loadUrl(byType.get(documentTypeForStateKey(key)));
    }

    const defaultDocs = result.documentosFondeo || getCredimovilDefaultDocs(Boolean(result.esVehiculoLegalizado));
    result.documentosFondeo = await Promise.all(defaultDocs.map(async (doc: any) => {
      const stored =
        byType.get(`FONDEO_${doc.id}`) ||
        byType.get(`FONDEO-${doc.id}`) ||
        byType.get(`doc-${doc.id}`) ||
        byType.get(String(doc.id));
      if (!stored) return { ...doc, archivoUrl: '', estatus: doc.estatus || 'PENDIENTE' };

      return {
        ...doc,
        estatus: stored.estatus || doc.estatus,
        archivoUrl: await loadUrl(stored),
        archivoNombre: stored.nombre || doc.archivoNombre,
        archivoTipo: stored.mime_type || doc.archivoTipo,
        archivoTamano: stored.tamano || doc.archivoTamano,
        observaciones: stored.observaciones || '',
        fechaSubida: stored.metadata?.fechaSubida || stored.created_at || doc.fechaSubida,
        subidoPor: stored.metadata?.subidoPor || doc.subidoPor,
      };
    }));

    return result;
  })();
}

async function getSupabaseLotes() {
  if (!supabase) return null;

  const { data: rows, error } = await supabase
    .from('lotes')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Supabase lotes: ${error.message}`);

  let users: any[] = [];
  const { data: userRows, error: usersError } = await supabase
    .from('lote_usuarios')
    .select('id,nombre,username,activo,lote_id,created_at')
    .order('created_at', { ascending: true });

  if (usersError) {
    // Keep the lot directory working even if the optional portal-user table
    // has not been created yet.
    console.warn('Supabase usuarios de lote no disponibles:', usersError.message);
  } else {
    users = userRows || [];
  }

  const usersByLot = new Map<string, any[]>();
  for (const user of users) {
    const list = usersByLot.get(user.lote_id) || [];
    list.push({
      id: user.id,
      nombre: user.nombre,
      username: user.username,
      activo: user.activo !== false,
      created_at: user.created_at,
    });
    usersByLot.set(user.lote_id, list);
  }

  return (rows || []).map((row: any) => ({
    ...mapSupabaseLote(row),
    usuariosPortal: usersByLot.get(row.id) || [],
  }));
}

async function uploadLegacyFileToSupabase(filePath: string, dbExpedienteId: string, tipo: string, metadata: Record<string, any> = {}) {
  const bytes = fs.readFileSync(filePath);
  const ext = path.extname(filePath).replace('.', '').toLowerCase();
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf'
  };
  const mime = mimeMap[ext] || 'application/octet-stream';
  const base64 = bytes.toString('base64');
  return uploadDataUriToSupabase(
    dbExpedienteId,
    tipo,
    `data:${mime};base64,${base64}`,
    path.basename(filePath),
    'SUBIDO',
    '',
    metadata
  );
}

async function migrateLegacyRenderDataToSupabase() {
  if (!supabase) return;

  const legacyDir = path.join(__dirname, 'data');
  if (!fs.existsSync(legacyDir)) return;

  console.warn('Supabase: detectado almacenamiento legado de Render. Iniciando migración única...');

  let complete = true;

  // Legacy lotes.
  const legacyLotesPath = path.join(legacyDir, 'lotes.json');
  if (fs.existsSync(legacyLotesPath)) {
    try {
      const lotes = JSON.parse(fs.readFileSync(legacyLotesPath, 'utf8') || '[]');
      for (const lote of Array.isArray(lotes) ? lotes : []) {
        const nombre = String(lote?.nombre || '').trim();
        if (!nombre) continue;

        const { data: existing, error } = await supabase
          .from('lotes')
          .select('id')
          .ilike('nombre', nombre)
          .limit(1);

        if (error) throw error;

        if (!existing?.length) {
          const { error: insertError } = await supabase.from('lotes').insert({
            nombre,
            contacto: String(lote?.contacto || ''),
            telefono: String(lote?.telefono || ''),
            correo: String(lote?.correo || ''),
            direccion: String(lote?.direccion || ''),
            ciudad: String(lote?.ciudad || 'México'),
            cuenta_clabe_default: String(lote?.cuentaClabeDefault || ''),
            banco_default: String(lote?.bancoDefault || ''),
            activo: lote?.activo !== false,
          });
          if (insertError) throw insertError;
        }
      }
    } catch (error: any) {
      complete = false;
      console.error('Migración legacy de lotes falló:', error?.message || error);
    }
  }

  // Legacy advisors.
  const legacyAdvisorsPath = path.join(legacyDir, 'asesores.json');
  if (fs.existsSync(legacyAdvisorsPath)) {
    try {
      const advisors = JSON.parse(fs.readFileSync(legacyAdvisorsPath, 'utf8') || '[]');
      for (const advisor of Array.isArray(advisors) ? advisors : []) {
        const username = normalizeUsername(advisor?.username);
        if (!username || !advisor?.passwordHash) continue;

        const { data: existing, error } = await supabase
          .from('asesores')
          .select('id')
          .eq('username', username)
          .maybeSingle();

        if (error) throw error;

        if (!existing) {
          const { error: insertError } = await supabase.from('asesores').insert({
            username,
            nombre: String(advisor?.nombre || username),
            password_hash: String(advisor.passwordHash),
            activo: advisor?.active !== false,
          });
          if (insertError) throw insertError;
        }
      }
    } catch (error: any) {
      complete = false;
      console.error('Migración legacy de asesores falló:', error?.message || error);
    }
  }

  // Legacy expedientes + local binary uploads.
  const legacyExpPath = path.join(legacyDir, 'expedientes.json');
  if (fs.existsSync(legacyExpPath)) {
    try {
      const expedientes = JSON.parse(fs.readFileSync(legacyExpPath, 'utf8') || '[]');

      for (const legacyExp of Array.isArray(expedientes) ? expedientes : []) {
        try {
          if (legacyExp?.folio) {
            await upsertExpedienteSupabase(legacyExp);
          }

          const dbRow = await getSupabaseExpedienteRowByFolio(String(legacyExp?.folio || ''));
          if (!dbRow) throw new Error(`No se encontró expediente migrado: ${legacyExp?.folio}`);

          const uploadDir = path.join(legacyDir, 'uploads', sanitizeFileName(String(legacyExp?.id || '')));
          if (fs.existsSync(uploadDir)) {
            const files = fs.readdirSync(uploadDir).filter((name) => fs.statSync(path.join(uploadDir, name)).isFile());

            for (const fileName of files) {
              const filePath = path.join(uploadDir, fileName);
              const lower = fileName.toLowerCase();

              let tipo = '';
              if (lower.includes('ine-frente')) tipo = 'INE_FRENTE';
              else if (lower.includes('ine-reverso')) tipo = 'INE_REVERSO';
              else if (lower.includes('comprobante-domicilio')) tipo = 'COMPROBANTE_DOMICILIO';
              else if (lower.includes('mes1')) tipo = 'ESTADO_CUENTA_MES1';
              else if (lower.includes('mes2')) tipo = 'ESTADO_CUENTA_MES2';
              else if (lower.includes('mes3')) tipo = 'ESTADO_CUENTA_MES3';
              else if (lower.includes('consolidado')) tipo = 'ESTADO_CUENTA_CONSOLIDADO';
              else if (lower.startsWith('doc-')) {
                const rawId = lower.replace(/^doc-/, '').split('.')[0];
                tipo = `FONDEO_${rawId}`;
              }

              if (!tipo) {
                complete = false;
                console.warn(`Archivo legacy sin tipo conocido: ${fileName}`);
                continue;
              }

              await uploadLegacyFileToSupabase(
                filePath,
                dbRow.id,
                tipo,
                {
                  migradoDesdeRender: true,
                  nombreOriginal: fileName,
                  fechaMigracion: new Date().toISOString(),
                }
              );
              fs.unlinkSync(filePath);
            }

            if (fs.readdirSync(uploadDir).length === 0) {
              fs.rmSync(uploadDir, { recursive: true, force: true });
            }
          }

          const refreshed = await getSupabaseExpedienteRowByFolio(String(legacyExp?.folio || ''));
          if (!refreshed) complete = false;
        } catch (expError: any) {
          complete = false;
          console.error(`Migración de expediente ${legacyExp?.folio || legacyExp?.id} falló:`, expError?.message || expError);
        }
      }
    } catch (error: any) {
      complete = false;
      console.error('Migración legacy de expedientes falló:', error?.message || error);
    }
  }

  if (complete) {
    try {
      fs.rmSync(legacyDir, { recursive: true, force: true });
      console.log('Migración legacy completada. Almacenamiento local de Render eliminado.');
    } catch (error: any) {
      console.warn('No se pudo eliminar todo el almacenamiento legacy de Render:', error?.message || error);
    }
  } else {
    console.warn('La migración legacy quedó incompleta; los archivos restantes se conservarán para no perder datos.');
  }
}

async function migrateEmbeddedDocumentsInSupabase() {
  if (!supabase) return;

  const { data, error } = await supabase
    .from('expedientes')
    .select('id,folio,pin_fondeo,estatus,lote_id,cliente_nombre,cliente_curp,cliente_rfc,telefono,correo,auto_marca,auto_modelo,auto_ano,monto_financiar,data')
    .order('updated_at', { ascending: false });

  if (error) {
    console.warn('Supabase: no se pudieron revisar documentos embebidos:', error.message);
    return;
  }

  let migrated = 0;
  for (const row of data || []) {
    const source = row.data && typeof row.data === 'object' ? row.data : {};
    const hasEmbeddedFile =
      isDataUri(source.fotoIneFrente) ||
      isDataUri(source.fotoIneReverso) ||
      isDataUri(source.comprobanteDomicilioActualUrl) ||
      Object.values(source.estadosCuenta || {}).some((v: any) => isDataUri(v)) ||
      (source.documentosFondeo || []).some((d: any) => isDataUri(d?.archivoUrl));

    if (!hasEmbeddedFile) continue;

    try {
      const exp = {
        ...source,
        id: source.id || `exp-${row.id}`,
        supabaseId: row.id,
        folio: row.folio,
        pinFondeo: row.pin_fondeo,
        estatus: row.estatus,
        loteId: row.lote_id || source.loteId || '',
        telefono: row.telefono || source.telefono || '',
        correo: row.correo || source.correo || '',
        autoMarca: row.auto_marca || source.autoMarca || '',
        autoModelo: row.auto_modelo || source.autoModelo || '',
        autoAno: row.auto_ano || source.autoAno || '',
        montoFinanciar: Number(row.monto_financiar || source.montoFinanciar || 0),
      };

      await upsertExpedienteSupabase(exp);
      migrated++;
      console.log(`Supabase: documentos embebidos migrados a Storage para ${row.folio}`);
    } catch (migrationError: any) {
      console.warn(`Supabase: no se pudo migrar documentos de ${row.folio}:`, migrationError?.message || migrationError);
    }
  }

  if (migrated > 0) {
    console.log(`Supabase: ${migrated} expediente(s) con archivos embebidos fueron migrados a Storage privado.`);
  }
}

async function getSupabaseExpedientes() {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('expedientes')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Supabase expedientes: ${error.message}`);

  const expedienteIds = (data || []).map((row: any) => row.id).filter(Boolean);
  let documentRows: any[] = [];

  if (expedienteIds.length > 0) {
    const { data: docs, error: docsError } = await supabase
      .from('documentos')
      .select('*')
      .in('expediente_id', expedienteIds);

    if (docsError) throw new Error(`Supabase documentos: ${docsError.message}`);
    documentRows = docs || [];
  }

  const docsByExpediente = new Map<string, any[]>();
  for (const doc of documentRows) {
    const list = docsByExpediente.get(doc.expediente_id) || [];
    list.push(doc);
    docsByExpediente.set(doc.expediente_id, list);
  }

  const result = [];
  for (const row of data || []) {
    const source = row.data && typeof row.data === 'object' ? row.data : {};
    const exp = {
      ...source,
      id: source.id || row.id,
      supabaseId: row.id,
      folio: row.folio || source.folio,
      pinFondeo: row.pin_fondeo || source.pinFondeo,
      estatus: row.estatus || source.estatus || 'NUEVO',
      loteId: row.lote_id || source.loteId || '',
      loteNombre: source.loteNombre || '',
      telefono: row.telefono || source.telefono || '',
      autoMarca: row.auto_marca || source.autoMarca || '',
      autoModelo: row.auto_modelo || source.autoModelo || '',
      autoAno: row.auto_ano || source.autoAno || '',
      montoFinanciar: Number(row.monto_financiar || source.montoFinanciar || 0),
      fechaCreacion: source.fechaCreacion || row.created_at,
      fechaActualizacion: source.fechaActualizacion || row.updated_at,
    };
    result.push(await applyStoredDocumentsToExpediente(exp, docsByExpediente.get(row.id) || []));
  }

  return result;
}

async function upsertExpedienteSupabase(exp: any) {
  if (!supabase || !exp?.folio) throw new Error('Supabase no está configurado.');

  const existing = await getSupabaseExpedienteRowByFolio(exp.folio);
  const dbId = existing?.id || randomUUID();
  const clean = await storeExpedienteDocuments(exp, dbId);
  const payload = {
    ...expedienteToSupabasePayload(clean),
    id: dbId,
    data: clean,
  };

  const { error } = await supabase
    .from('expedientes')
    .upsert(payload, { onConflict: 'folio' });

  if (error) throw new Error(`Supabase expediente ${exp.folio}: ${error.message}`);

  return dbId;
}

function sanitizeLoteForPublic(lote: any) {
  return { id: lote.id, nombre: lote.nombre, ciudad: lote.ciudad };
}

// 1. Health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    name: 'CrediMóvil OCR & Fondeo API',
    geminiConfigured: Boolean(GEMINI_API_KEY),
    geminiKeySource: process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY' : (process.env.GOOGLE_API_KEY ? 'GOOGLE_API_KEY' : 'none'),
    supabaseConfigured: Boolean(supabase),
    supabaseUrl: SUPABASE_URL || null,
  });
});

// 2. Authentication and Advisor Management
app.post('/api/auth/login', async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || '');

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Usuario y contraseña son obligatorios.' });
  }

  const adminUsername = normalizeUsername(process.env.CREDIMOVIL_ADMIN_USER || '');
  const adminPassword = String(process.env.CREDIMOVIL_ADMIN_PASSWORD || '');

  if (!adminUsername || !adminPassword) {
    return res.status(503).json({
      success: false,
      message: 'La cuenta administradora no está configurada. Agrega CREDIMOVIL_ADMIN_USER y CREDIMOVIL_ADMIN_PASSWORD en Render → Environment.',
    });
  }

  let account: { role: 'admin' | 'asesor' | 'lote'; nombre: string; loteId?: string } | null = null;

  if (username === adminUsername && safeEqualText(password, adminPassword)) {
    account = { role: 'admin', nombre: 'Administrador CrediMóvil' };
  } else {
    const user = await findAdvisor(username);
    if (user && user.activo !== false && verifyPassword(password, user.password_hash)) {
      account = { role: 'asesor', nombre: user.nombre || username };
    } else if (supabase) {
      const loteUser = await findLoteUser(username);
      if (loteUser && loteUser.activo !== false && verifyPassword(password, loteUser.password_hash)) {
        account = {
          role: 'lote',
          nombre: loteUser.nombre || username,
          loteId: loteUser.lote_id,
        };
      }
    }
  }

  if (!account) {
    return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos.' });
  }

  const token = randomUUID();
  sessions.set(token, {
    username,
    role: account.role,
    nombre: account.nombre,
    loteId: account.loteId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });

  res.json({
    success: true,
    token,
    user: { username, role: account.role, nombre: account.nombre, loteId: account.loteId || null },
  });
});

app.get('/api/auth/me', (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  res.json({ success: true, user: { username: session.username, role: session.role, nombre: session.nombre, loteId: session.loteId || null } });
});

app.post('/api/auth/logout', (req, res) => {
  const token = getBearerToken(req);
  if (token) sessions.delete(token);
  res.json({ success: true });
});

app.get('/api/asesores', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const users = await supabaseAdvisorList();
    res.json({
      success: true,
      asesores: users.map((user: any) => ({
        id: user.id,
        username: user.username,
        nombre: user.nombre,
        active: user.activo !== false,
        fechaCreacion: user.created_at,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'No se pudieron consultar los asesores.' });
  }
});

app.post('/api/asesores', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || '');
  const nombre = String(req.body?.nombre || '').trim();

  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    return res.status(400).json({ success: false, message: 'El usuario debe tener entre 3 y 30 caracteres y solo usar letras, números, punto, guion o guion bajo.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres.' });
  }
  if (nombre.length < 2) {
    return res.status(400).json({ success: false, message: 'El nombre del asesor es obligatorio.' });
  }

  try {
    const existing = await findAdvisor(username);
    if (existing || normalizeUsername(process.env.CREDIMOVIL_ADMIN_USER || '') === username) {
      return res.status(409).json({ success: false, message: 'Ese usuario ya existe.' });
    }

    const { data, error } = await supabase
      .from('asesores')
      .insert({
        username,
        nombre,
        password_hash: hashPassword(password),
        activo: true,
      })
      .select('id,nombre,username,activo,created_at')
      .single();

    if (error) throw new Error(`Supabase asesor: ${error.message}`);

    res.status(201).json({
      success: true,
      asesor: {
        id: data.id,
        username: data.username,
        nombre: data.nombre,
        active: data.activo !== false,
        fechaCreacion: data.created_at,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'No se pudo crear el asesor.' });
  }
});

app.delete('/api/asesores/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { error } = await supabase.from('asesores').delete().eq('id', req.params.id);
    if (error) throw new Error(`Supabase asesor: ${error.message}`);
    res.json({ success: true, message: 'Usuario de asesor eliminado.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'No se pudo eliminar el asesor.' });
  }
});

app.get('/api/lote-usuarios', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const users = await supabaseLoteUserList();
    res.json({ success: true, usuarios: users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'No se pudieron consultar los usuarios de lotes.' });
  }
});

app.post('/api/lote-usuarios', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const loteId = String(req.body?.loteId || '').trim();
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || '');
  const nombre = String(req.body?.nombre || '').trim();

  if (!supabase) return res.status(503).json({ success: false, message: 'Supabase no está configurado en el servidor.' });
  if (!loteId) return res.status(400).json({ success: false, message: 'Selecciona un lote.' });
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    return res.status(400).json({ success: false, message: 'El usuario debe tener entre 3 y 30 caracteres y solo usar letras, números, punto, guion o guion bajo.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres.' });
  }
  if (nombre.length < 2) {
    return res.status(400).json({ success: false, message: 'El nombre del usuario del lote es obligatorio.' });
  }

  try {
    const { data: lote, error: loteError } = await supabase
      .from('lotes')
      .select('id,nombre')
      .eq('id', loteId)
      .maybeSingle();

    if (loteError) throw new Error(`Supabase lote: ${loteError.message}`);
    if (!lote) return res.status(404).json({ success: false, message: 'El lote seleccionado no existe.' });

    const existing = await findLoteUser(username);
    if (existing) return res.status(409).json({ success: false, message: 'Ese usuario ya existe.' });

    const { data, error } = await supabase
      .from('lote_usuarios')
      .insert({
        lote_id: loteId,
        nombre,
        username,
        password_hash: hashPassword(password),
        activo: true,
      })
      .select('id,nombre,username,activo,lote_id,created_at')
      .single();

    if (error) throw new Error(`Supabase usuario de lote: ${error.message}`);

    res.status(201).json({
      success: true,
      usuario: data,
      loteNombre: lote.nombre,
      message: 'Usuario de lote creado correctamente.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'No se pudo crear el usuario del lote.' });
  }
});

app.delete('/api/lote-usuarios/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (!supabase) return res.status(503).json({ success: false, message: 'Supabase no está configurado en el servidor.' });

  try {
    const { error } = await supabase.from('lote_usuarios').delete().eq('id', req.params.id);
    if (error) throw new Error(`Supabase usuario de lote: ${error.message}`);
    res.json({ success: true, message: 'Usuario de lote eliminado correctamente.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'No se pudo eliminar el usuario del lote.' });
  }
});

// Helper: Sleep utility for exponential backoff
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: Call Gemini models with multi-model fallback and backoff retry for 503 / 429
async function callGeminiWithResilience(
  parts: any[],
  purpose: string
): Promise<string> {
  // Ordered by speed, quota availability, and multimodal OCR accuracy
  const candidateModels = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash-lite'];

  if (!ai) {
    throw new Error('GEMINI_API_KEY no está configurada en el servidor. Configúrala en Render → Environment.');
  }
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

// Portal seguro de usuarios de lote: solo ve los créditos asociados a su propio lote.
app.get('/api/lote/expedientes', async (req, res) => {
  const session = requireLote(req, res);
  if (!session) return;

  try {
    const all = (await getSupabaseExpedientes()) || [];
    const expedientes = all
      .filter((e: any) => e.loteId === session.loteId)
      .map((e: any) => {
        const docs = e.documentosFondeo || [];
        const requiredDocs = docs.filter((d: any) => d.requerido);
        const uploadedRequired = requiredDocs.filter((d: any) => d.estatus === 'SUBIDO' || d.estatus === 'APROBADO');
        return {
          id: e.id,
          folio: e.folio,
          estatus: e.estatus,
          clienteNombre: e.ine?.nombreCompleto || e.ine?.nombre || '',
          telefono: e.telefono || '',
          autoMarca: e.autoMarca || '',
          autoModelo: e.autoModelo || '',
          autoAno: e.autoAno || null,
          montoFinanciar: Number(e.montoFinanciar) || 0,
          fechaCreacion: e.fechaCreacion,
          fechaActualizacion: e.fechaActualizacion,
          docsSubidos: uploadedRequired.length,
          docsRequeridos: requiredDocs.length,
        };
      });

    res.json({ success: true, expedientes });
  } catch (error: any) {
    console.error('GET /api/lote/expedientes error:', error);
    res.status(500).json({ success: false, message: error?.message || 'No se pudieron cargar tus créditos.' });
  }
});

// Chat directo Lote <-> Equipo CrediMóvil.
app.get('/api/lotes/:loteId/chat', async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ success: false, message: 'Debes iniciar sesión.' });

  const loteId = session.role === 'lote' ? session.loteId : String(req.params.loteId || '');
  if (!loteId || !canAccessLote(session, loteId)) {
    return res.status(403).json({ success: false, message: 'No tienes acceso a este chat.' });
  }

  try {
    const { data: lote, error: loteError } = await supabase
      .from('lotes')
      .select('id,nombre')
      .eq('id', loteId)
      .maybeSingle();

    if (loteError) throw new Error(`Supabase lote chat: ${loteError.message}`);
    if (!lote) return res.status(404).json({ success: false, message: 'Lote no encontrado.' });

    const { data: messages, error } = await supabase
      .from('lote_chat_mensajes')
      .select('*')
      .eq('lote_id', loteId)
      .order('created_at', { ascending: true })
      .limit(300);

    if (error) throw new Error(`Supabase chat: ${error.message}`);

    res.json({ success: true, lote, mensajes: messages || [] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'No se pudo cargar el chat.' });
  }
});

app.post('/api/lotes/:loteId/chat', async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ success: false, message: 'Debes iniciar sesión.' });

  const loteId = session.role === 'lote' ? session.loteId : String(req.params.loteId || '');
  if (!loteId || !canAccessLote(session, loteId)) {
    return res.status(403).json({ success: false, message: 'No tienes acceso a este chat.' });
  }

  const mensaje = String(req.body?.mensaje || '').trim();
  if (!mensaje) return res.status(400).json({ success: false, message: 'Escribe un mensaje.' });
  if (mensaje.length > 2000) return res.status(400).json({ success: false, message: 'El mensaje no puede superar 2,000 caracteres.' });

  try {
    const { data, error } = await supabase
      .from('lote_chat_mensajes')
      .insert({
        lote_id: loteId,
        autor_tipo: session.role,
        autor_usuario: session.username,
        autor_nombre: session.nombre,
        mensaje,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Supabase chat: ${error.message}`);
    res.status(201).json({ success: true, mensaje: data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'No se pudo enviar el mensaje.' });
  }
});

// Comentarios y solicitudes ligadas al folio.
app.get('/api/expedientes/:id/comentarios', async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ success: false, message: 'Debes iniciar sesión.' });

  try {
    const exp = await getExpedienteRowByIdOrFolio(req.params.id);
    if (!exp) return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });

    if (!canAccessLote(session, exp.lote_id || '')) {
      return res.status(403).json({ success: false, message: 'No tienes acceso a los comentarios de este expediente.' });
    }

    const { data, error } = await supabase
      .from('expediente_comentarios')
      .select('*')
      .eq('expediente_id', exp.id)
      .order('created_at', { ascending: true })
      .limit(300);

    if (error) throw new Error(`Supabase comentarios: ${error.message}`);
    res.json({ success: true, comentarios: data || [] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'No se pudieron cargar los comentarios.' });
  }
});

app.post('/api/expedientes/:id/comentarios', async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ success: false, message: 'Debes iniciar sesión.' });

  const comentario = String(req.body?.comentario || '').trim();
  const tipo = req.body?.tipo === 'SOLICITUD' ? 'SOLICITUD' : 'COMENTARIO';

  if (!comentario) return res.status(400).json({ success: false, message: 'Escribe un comentario.' });
  if (comentario.length > 3000) return res.status(400).json({ success: false, message: 'El comentario no puede superar 3,000 caracteres.' });

  try {
    const exp = await getExpedienteRowByIdOrFolio(req.params.id);
    if (!exp) return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });

    if (!canAccessLote(session, exp.lote_id || '')) {
      return res.status(403).json({ success: false, message: 'No tienes acceso a este expediente.' });
    }

    const { data, error } = await supabase
      .from('expediente_comentarios')
      .insert({
        expediente_id: exp.id,
        autor_tipo: session.role,
        autor_usuario: session.username,
        autor_nombre: session.nombre,
        tipo,
        comentario,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Supabase comentario: ${error.message}`);
    res.status(201).json({ success: true, comentario: data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'No se pudo guardar el comentario.' });
  }
});

// 4. Lotes de Autos
app.get('/api/lotes', async (req, res) => {
  try {
    const session = getSession(req);
    const lotes = (await getSupabaseLotes()) || [];

    if (!session) {
      return res.json({ success: true, lotes: lotes.map(sanitizeLoteForPublic) });
    }

    const expedientes = (await getSupabaseExpedientes()) || [];
    const lotesWithStats = lotes.map((l: any) => {
      const exps = expedientes.filter((e: any) => e.loteId === l.id);
      return {
        ...l,
        totalExpedientes: exps.length,
        totalFondeados: exps.filter((e: any) => e.estatus === 'FONDEADO').length,
      };
    });

    res.json({ success: true, lotes: lotesWithStats });
  } catch (error: any) {
    console.error('GET /api/lotes error:', error);
    res.status(500).json({ success: false, message: error?.message || 'No se pudieron cargar los lotes.' });
  }
});

app.post('/api/lotes', async (req, res) => {
  if (!requireStaff(req, res)) return;

  const { nombre, contacto, telefono, correo, direccion, ciudad, cuentaClabeDefault, bancoDefault } = req.body;
  const nombreLote = String(nombre || '').trim();

  if (!nombreLote) {
    return res.status(400).json({ success: false, message: 'El nombre del lote es obligatorio.' });
  }

  try {
    const { data: existing, error: findError } = await supabase
      .from('lotes')
      .select('*')
      .ilike('nombre', nombreLote)
      .limit(1);

    if (findError) throw new Error(`Supabase lotes: ${findError.message}`);
    if (existing && existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe un lote con ese nombre.',
        lote: mapSupabaseLote(existing[0]),
      });
    }

    const { data, error } = await supabase
      .from('lotes')
      .insert({
        nombre: nombreLote,
        contacto: String(contacto || ''),
        telefono: String(telefono || ''),
        correo: String(correo || ''),
        direccion: String(direccion || ''),
        ciudad: String(ciudad || 'México'),
        cuenta_clabe_default: String(cuentaClabeDefault || ''),
        banco_default: String(bancoDefault || ''),
        activo: true,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Supabase lotes: ${error.message}`);

    res.status(201).json({
      success: true,
      lote: mapSupabaseLote(data),
      message: 'Lote registrado correctamente en Supabase.',
    });
  } catch (error: any) {
    console.error('POST /api/lotes error:', error);
    res.status(500).json({ success: false, message: error?.message || 'No se pudo registrar el lote.' });
  }
});

app.delete('/api/lotes/:id', async (req, res) => {
  if (!requireStaff(req, res)) return;

  try {
    const { data: lote, error: loteError } = await supabase
      .from('lotes')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle();

    if (loteError) throw new Error(`Supabase lote: ${loteError.message}`);
    if (!lote) return res.status(404).json({ success: false, message: 'Lote no encontrado.' });

    const { count, error: countError } = await supabase
      .from('expedientes')
      .select('id', { count: 'exact', head: true })
      .eq('lote_id', req.params.id);

    if (countError) throw new Error(`Supabase expedientes del lote: ${countError.message}`);
    if ((count || 0) > 0) {
      return res.status(409).json({ success: false, message: 'No puedes eliminar un lote que ya tiene expedientes asociados.' });
    }

    const { error } = await supabase.from('lotes').delete().eq('id', req.params.id);
    if (error) throw new Error(`Supabase lote: ${error.message}`);

    res.json({ success: true, message: 'Lote eliminado correctamente de Supabase.' });
  } catch (error: any) {
    console.error('DELETE /api/lotes error:', error);
    res.status(500).json({ success: false, message: error?.message || 'No se pudo eliminar el lote.' });
  }
});

// 5. Expedientes (CRUD)
app.get('/api/expedientes', async (req, res) => {
  if (!requireStaff(req, res)) return;

  try {
    let list = (await getSupabaseExpedientes()) || [];
    const { q, estatus, loteId } = req.query;

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
        return nombre.includes(query) || curp.includes(query) || rfc.includes(query) ||
          folio.includes(query) || lote.includes(query) || auto.includes(query);
      });
    }

    list.sort((a: any, b: any) =>
      new Date(b.fechaActualizacion || b.fechaCreacion).getTime() -
      new Date(a.fechaActualizacion || a.fechaCreacion).getTime()
    );

    res.json({ success: true, count: list.length, expedientes: list });
  } catch (error: any) {
    console.error('GET /api/expedientes error:', error);
    res.status(500).json({ success: false, message: error?.message || 'No se pudieron cargar los expedientes.' });
  }
});

app.get('/api/expedientes/:id', async (req, res) => {
  if (!requireStaff(req, res)) return;

  try {
    const list = (await getSupabaseExpedientes()) || [];
    const item = list.find((e: any) => e.id === req.params.id || e.folio === req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });
    }
    res.json({ success: true, expediente: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'No se pudo cargar el expediente.' });
  }
});

app.post('/api/expedientes/by-folio', async (req, res) => {
  const { folio, pinFondeo } = req.body;
  if (!folio) {
    return res.status(400).json({ success: false, message: 'Debe ingresar el folio del expediente.' });
  }

  try {
    const { data: row, error } = await supabase
      .from('expedientes')
      .select('id,folio,pin_fondeo,data')
      .eq('folio', String(folio).trim().toUpperCase())
      .maybeSingle();

    if (error) throw new Error(`Supabase expediente por folio: ${error.message}`);
    if (!row) return res.status(404).json({ success: false, message: 'No se encontró ningún expediente con ese folio.' });

    if (pinFondeo && row.pin_fondeo && pinFondeo.trim() !== row.pin_fondeo.trim()) {
      return res.status(401).json({ success: false, message: 'PIN de acceso del lote incorrecto.' });
    }

    const list = (await getSupabaseExpedientes()) || [];
    const item = list.find((e: any) => e.folio === row.folio);
    if (!item) return res.status(404).json({ success: false, message: 'No se pudo reconstruir el expediente.' });

    res.json({ success: true, expediente: item });
  } catch (error: any) {
    console.error('POST /api/expedientes/by-folio error:', error);
    res.status(500).json({ success: false, message: error?.message || 'No se pudo consultar el expediente.' });
  }
});

app.post('/api/expedientes', async (req, res) => {
  if (!supabase) return res.status(503).json({ success: false, message: 'Supabase no está configurado.' });

  try {
    const expedientes = (await getSupabaseExpedientes()) || [];
    const highestFolio = expedientes.reduce((max: number, exp: any) => {
      const match = String(exp?.folio || '').match(/^EXP-\\d{4}-(\\d+)$/);
      const n = match ? Number(match[1]) : 0;
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 1000);

    const nextNum = highestFolio + 1;
    const folio = `EXP-2026-${nextNum}`;
    const pinFondeo = Math.floor(1000 + Math.random() * 9000).toString();
    const body = req.body || {};
    const now = new Date().toISOString();
    const esLegalizado = Boolean(body.esVehiculoLegalizado);
    const docsFondeo = body.documentosFondeo || getCredimovilDefaultDocs(esLegalizado);

    const newExpediente = {
      id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      folio,
      pinFondeo,
      fechaCreacion: now,
      fechaActualizacion: now,
      estatus: body.estatus || 'NUEVO',
      ine: body.ine || {},
      fotoIneFrente: body.fotoIneFrente || '',
      fotoIneReverso: body.fotoIneReverso || '',
      domicilioCoincideConIne: body.domicilioCoincideConIne !== undefined ? Boolean(body.domicilioCoincideConIne) : true,
      comprobanteDomicilioActualUrl: body.comprobanteDomicilioActualUrl || '',
      comprobanteDomicilioActualNombre: body.comprobanteDomicilioActualNombre || '',
      tipoComprobanteDomicilio: body.tipoComprobanteDomicilio || 'CFE_LUZ',
      estadosCuenta: body.estadosCuenta || {},
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
      loteId: body.loteId || null,
      loteNombre: body.loteNombre || 'Directo / Asesor',
      asesorLoteContacto: body.asesorLoteContacto || '',
      telefonoLote: body.telefonoLote || '',
      autoMarca: body.autoMarca || '',
      autoModelo: body.autoModelo || '',
      autoAno: Number(body.autoAno) || new Date().getFullYear(),
      autoVersion: body.autoVersion || '',
      autoPrecio: Number(body.autoPrecio) || 0,
      autoVin: body.autoVin || '',
      esVehiculoLegalizado: esLegalizado,
      enganche: Number(body.enganche) || 0,
      engancheModo: body.engancheModo || 'PORCENTAJE',
      enganchePorcentaje: Number(body.enganchePorcentaje) || 20,
      montoFinanciar: Number(body.montoFinanciar) || Math.max(0, (Number(body.autoPrecio) || 0) - (Number(body.enganche) || 0)),
      plazoMeses: Number(body.plazoMeses) || 48,
      tasaInteresAnual: 28,
      mensualidadEstimada: calculateCredimovilMonthlyPayment(Number(body.montoFinanciar) || 0, Number(body.plazoMeses) || 48),
      financieraAsignada: body.financieraAsignada || 'CrediMóvil Auto',
      documentosFondeo: docsFondeo,
      cuentaClabeLote: body.cuentaClabeLote || '',
      bancoLote: body.bancoLote || '',
      notasAsesor: body.notasAsesor || 'Expediente registrado en CrediMóvil para análisis.',
    };

    await upsertExpedienteSupabase(newExpediente);
    const saved = (await getSupabaseExpedientes())?.find((e: any) => e.folio === folio);

    res.status(201).json({
      success: true,
      message: 'Expediente guardado exitosamente en CrediMóvil y Supabase.',
      expediente: saved || newExpediente,
    });
  } catch (error: any) {
    console.error('POST /api/expedientes error:', error);
    res.status(500).json({ success: false, message: error?.message || 'No se pudo guardar el expediente.' });
  }
});

app.put('/api/expedientes/:id', async (req, res) => {
  if (!requireStaff(req, res)) return;

  try {
    const expedientes = (await getSupabaseExpedientes()) || [];
    const existing = expedientes.find((e: any) => e.id === req.params.id || e.folio === req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });

    const updated = {
      ...existing,
      ...req.body,
      tasaInteresAnual: 28,
      mensualidadEstimada: calculateCredimovilMonthlyPayment(
        Number((req.body?.montoFinanciar ?? existing.montoFinanciar)) || 0,
        Number((req.body?.plazoMeses ?? existing.plazoMeses)) || 48
      ),
      id: existing.id,
      folio: existing.folio,
      pinFondeo: existing.pinFondeo,
      fechaActualizacion: new Date().toISOString(),
    };

    if (!updated.documentosFondeo || updated.documentosFondeo.length === 0) {
      updated.documentosFondeo = getCredimovilDefaultDocs(Boolean(updated.esVehiculoLegalizado));
    }

    await upsertExpedienteSupabase(updated);
    const saved = (await getSupabaseExpedientes())?.find((e: any) => e.folio === existing.folio);

    res.json({ success: true, expediente: saved || updated, message: 'Expediente actualizado exitosamente.' });
  } catch (error: any) {
    console.error('PUT /api/expedientes/:id error:', error);
    res.status(500).json({ success: false, message: error?.message || 'No se pudo actualizar el expediente.' });
  }
});

app.delete('/api/expedientes/:id', async (req, res) => {
  if (!requireStaff(req, res)) return;

  try {
    const expedientes = (await getSupabaseExpedientes()) || [];
    const original = expedientes.find((e: any) => e.id === req.params.id || e.folio === req.params.id);
    if (!original) return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });

    const { data: row, error: rowError } = await supabase
      .from('expedientes')
      .select('id,folio')
      .eq('folio', original.folio)
      .maybeSingle();
    if (rowError) throw new Error(`Supabase expediente: ${rowError.message}`);

    if (row?.id) {
      const { data: docs } = await supabase.from('documentos').select('storage_path').eq('expediente_id', row.id);
      const paths = (docs || []).map((d: any) => d.storage_path).filter(Boolean);
      if (paths.length) await supabase.storage.from(SUPABASE_BUCKET).remove(paths);
      await supabase.from('documentos').delete().eq('expediente_id', row.id);
    }

    const { error: deleteError } = await supabase.from('expedientes').delete().eq('folio', original.folio);
    if (deleteError) throw new Error(`Supabase expediente: ${deleteError.message}`);

    res.json({ success: true, message: 'Expediente y documentos eliminados de Supabase.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'No se pudo eliminar el expediente.' });
  }
});

app.post('/api/expedientes/:id/documentos', async (req, res) => {
  if (!requireStaff(req, res)) return;

  try {
    const { tipo, archivoData, archivoNombre, displayName } = req.body || {};
    const allowed = new Set([
      'INE_FRENTE',
      'INE_REVERSO',
      'COMPROBANTE_DOMICILIO',
      'ESTADO_CUENTA_MES1',
      'ESTADO_CUENTA_MES2',
      'ESTADO_CUENTA_MES3',
      'ESTADO_CUENTA_CONSOLIDADO',
    ]);

    if (!allowed.has(String(tipo || ''))) {
      return res.status(400).json({ success: false, message: 'Tipo de documento no permitido.' });
    }

    if (!isDataUri(archivoData)) {
      return res.status(400).json({ success: false, message: 'Debes seleccionar un archivo válido.' });
    }

    const expedientes = (await getSupabaseExpedientes()) || [];
    const exp = expedientes.find((e: any) => e.id === req.params.id || e.folio === req.params.id);
    if (!exp) {
      return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });
    }

    const row = await getSupabaseExpedienteRowByFolio(exp.folio);
    if (!row?.id) {
      return res.status(404).json({ success: false, message: 'No se encontró el registro persistente del expediente.' });
    }

    await uploadDataUriToSupabase(
      row.id,
      String(tipo),
      archivoData,
      String(archivoNombre || displayName || tipo),
      'SUBIDO',
      '',
      {
        cargaPosterior: true,
        displayName: String(displayName || tipo),
        fechaSubida: new Date().toISOString(),
      }
    );

    const saved = (await getSupabaseExpedientes())?.find((e: any) => e.folio === exp.folio);
    if (!saved) return res.status(500).json({ success: false, message: 'Documento guardado, pero no se pudo reconstruir el expediente.' });

    res.json({
      success: true,
      message: `${displayName || tipo} guardado en Supabase Storage.`,
      expediente: saved,
    });
  } catch (error: any) {
    console.error('POST /api/expedientes/:id/documentos error:', error);
    res.status(500).json({ success: false, message: error?.message || 'No se pudo subir el documento.' });
  }
});

app.post('/api/expedientes/:id/fondeo-doc', async (req, res) => {
  if (!requireStaff(req, res)) return;
  try {
    const { docId, archivoUrl, archivoNombre, archivoTamano, subidoPor } = req.body;
    const expedientes = (await getSupabaseExpedientes()) || [];
    const exp = expedientes.find((e: any) => e.id === req.params.id || e.folio === req.params.id);
    if (!exp) return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });

    if (!exp.documentosFondeo) exp.documentosFondeo = getCredimovilDefaultDocs(Boolean(exp.esVehiculoLegalizado));
    const doc = exp.documentosFondeo.find((d: any) => d.id === docId);
    if (!doc) return res.status(404).json({ success: false, message: 'Tipo de documento no encontrado en el checklist.' });

    if (isDataUri(archivoUrl)) {
      doc.archivoUrl = archivoUrl;
      doc.archivoNombre = archivoNombre || doc.id;
      doc.archivoTamano = archivoTamano || 'Cargado';
      doc.archivoTipo = extractMimeAndBase64(archivoUrl).mimeType;
    }
    doc.estatus = 'SUBIDO';
    doc.subidoPor = subidoPor || exp.loteNombre || 'Lote de Autos';
    doc.observaciones = '';

    if (exp.estatus === 'APROBADO' || exp.estatus === 'FONDEO_PENDIENTE') {
      exp.estatus = 'FONDEO_REVISION';
    }
    exp.fechaActualizacion = new Date().toISOString();

    await upsertExpedienteSupabase(exp);
    const saved = (await getSupabaseExpedientes())?.find((e: any) => e.folio === exp.folio);

    res.json({
      success: true,
      message: `Documento "${doc.nombre}" subido exitosamente en CrediMóvil.`,
      documentosFondeo: saved?.documentosFondeo || exp.documentosFondeo,
      expedienteEstatus: saved?.estatus || exp.estatus,
    });
  } catch (error: any) {
    console.error('POST /api/expedientes/:id/fondeo-doc error:', error);
    res.status(500).json({ success: false, message: error?.message || 'No se pudo subir el documento.' });
  }
});

app.put('/api/expedientes/:id/fondeo-doc-review', async (req, res) => {
  if (!requireStaff(req, res)) return;
  try {
    const { docId, estatus, observaciones } = req.body;
    const expedientes = (await getSupabaseExpedientes()) || [];
    const exp = expedientes.find((e: any) => e.id === req.params.id || e.folio === req.params.id);
    if (!exp) return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });

    const doc = exp.documentosFondeo?.find((d: any) => d.id === docId);
    if (!doc) return res.status(404).json({ success: false, message: 'Documento no encontrado.' });

    doc.estatus = estatus;
    doc.observaciones = observaciones || '';
    doc.fechaRevision = new Date().toISOString();
    exp.fechaActualizacion = new Date().toISOString();

    await upsertExpedienteSupabase(exp);
    const saved = (await getSupabaseExpedientes())?.find((e: any) => e.folio === exp.folio);

    res.json({
      success: true,
      message: `Estatus del documento actualizado a ${estatus}.`,
      expediente: saved || exp,
    });
  } catch (error: any) {
    console.error('PUT /api/expedientes/:id/fondeo-doc-review error:', error);
    res.status(500).json({ success: false, message: error?.message || 'No se pudo actualizar el documento.' });
  }
});

app.get('/api/stats', async (req, res) => {
  if (!requireStaff(req, res)) return;

  try {
    const expedientes = (await getSupabaseExpedientes()) || [];
    const total = expedientes.length;
    const nuevos = expedientes.filter((e: any) => e.estatus === 'NUEVO').length;
    const preAprobados = expedientes.filter((e: any) => e.estatus === 'PRE_APROBADO').length;
    const enEvaluacion = expedientes.filter((e: any) => e.estatus === 'EN_EVALUACION').length;
    const aprobados = expedientes.filter((e: any) => e.estatus === 'APROBADO').length;
    const contratos = expedientes.filter((e: any) => e.estatus === 'CONTRATO').length;
    const gps = expedientes.filter((e: any) => e.estatus === 'GPS').length;
    const fondeo = expedientes.filter((e: any) =>
      e.estatus === 'FONDEO' || e.estatus === 'FONDEO_PENDIENTE' || e.estatus === 'FONDEO_REVISION' || e.estatus === 'FONDEADO'
    ).length;
    const fondeados = expedientes.filter((e: any) => e.estatus === 'FONDEADO').length;
    const montoTotalFinanciado = expedientes
      .filter((e: any) => e.estatus === 'FONDEADO' || e.estatus === 'APROBADO')
      .reduce((acc: number, curr: any) => acc + (Number(curr.montoFinanciar) || 0), 0);

    res.json({
      success: true,
      stats: {
        total,
        nuevos,
        preAprobados,
        enEvaluacion,
        aprobados,
        contratos,
        gps,
        fondeo,
        fondeados,
        montoTotalFinanciado,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'No se pudieron cargar las estadísticas.' });
  }
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
  if (!supabaseConfigured()) {
    throw new Error('Supabase es obligatorio para CrediMóvil. Configura SUPABASE_URL y SUPABASE_SECRET_KEY en Render.');
  }

  console.log('Supabase configurado. CrediMóvil usará Supabase Database + Storage como única persistencia.');
  await migrateLegacyRenderDataToSupabase();
  await migrateEmbeddedDocumentsInSupabase();

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
