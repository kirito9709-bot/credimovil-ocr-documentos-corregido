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

function supabaseConfigured() {
  return Boolean(supabase);
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
  observaciones = ''
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
          working.estadosCuenta[nameKey] || key
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
        doc.observaciones || ''
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
      const stored = byType.get(`FONDEO_${doc.id}`);
      if (!stored) return { ...doc, archivoUrl: '' };

      return {
        ...doc,
        estatus: stored.estatus || doc.estatus,
        archivoUrl: await loadUrl(stored),
        archivoNombre: stored.nombre || doc.archivoNombre,
        archivoTipo: stored.mime_type || doc.archivoTipo,
        archivoTamano: stored.tamano || doc.archivoTamano,
        observaciones: stored.observaciones || '',
        fechaSubida: stored.created_at || doc.fechaSubida,
      };
    }));

    return result;
  })();
}

async function getSupabaseExpedientes() {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('expedientes')
    .select('*,documentos(*)')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Supabase expedientes: ${error.message}`);

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
    result.push(await applyStoredDocumentsToExpediente(exp, row.documentos || []));
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
    const user = advisorRecords().find((item: any) => item.username === username && item.active !== false);
    if (user && verifyPassword(password, user.passwordHash)) {
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

app.get('/api/asesores', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const users = advisorRecords().map((user: any) => ({
    id: user.id,
    username: user.username,
    nombre: user.nombre,
    active: user.active !== false,
    fechaCreacion: user.fechaCreacion,
  }));
  res.json({ success: true, asesores: users });
});

app.post('/api/asesores', (req, res) => {
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

  const records = advisorRecords();
  if (records.some((item: any) => item.username === username) || normalizeUsername(process.env.CREDIMOVIL_ADMIN_USER || '') === username) {
    return res.status(409).json({ success: false, message: 'Ese usuario ya existe.' });
  }

  const record = {
    id: `asesor-${Date.now()}-${randomBytes(3).toString('hex')}`,
    username,
    nombre,
    passwordHash: hashPassword(password),
    active: true,
    fechaCreacion: new Date().toISOString(),
  };
  records.push(record);
  writeAdvisorRecords(records);

  res.status(201).json({
    success: true,
    asesor: { id: record.id, username: record.username, nombre: record.nombre, active: true, fechaCreacion: record.fechaCreacion },
  });
});

app.delete('/api/asesores/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const records = advisorRecords();
  const index = records.findIndex((item: any) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ success: false, message: 'Asesor no encontrado.' });
  records.splice(index, 1);
  writeAdvisorRecords(records);
  res.json({ success: true, message: 'Usuario de asesor eliminado.' });
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
    if (supabase) {
      const { data, error } = await supabase
        .from('expedientes')
        .select('id,folio,estatus,cliente_nombre,telefono,auto_marca,auto_modelo,auto_ano,monto_financiar,created_at,updated_at,data')
        .eq('lote_id', session.loteId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(`Supabase expedientes del lote: ${error.message}`);

      const expedientes = (data || []).map((row: any) => {
        const source = row.data || {};
        const docs = source.documentosFondeo || [];
        const requiredDocs = docs.filter((d: any) => d.requerido);
        const uploadedRequired = requiredDocs.filter((d: any) => d.estatus === 'SUBIDO' || d.estatus === 'APROBADO');
        return {
          id: row.id,
          folio: row.folio,
          estatus: row.estatus,
          clienteNombre: row.cliente_nombre || source.ine?.nombreCompleto || source.ine?.nombre || '',
          telefono: row.telefono || source.telefono || '',
          autoMarca: row.auto_marca || source.autoMarca || '',
          autoModelo: row.auto_modelo || source.autoModelo || '',
          autoAno: row.auto_ano || source.autoAno || null,
          montoFinanciar: Number(row.monto_financiar) || Number(source.montoFinanciar) || 0,
          fechaCreacion: source.fechaCreacion || row.created_at,
          fechaActualizacion: source.fechaActualizacion || row.updated_at,
          docsSubidos: uploadedRequired.length,
          docsRequeridos: requiredDocs.length,
        };
      });

      return res.json({ success: true, expedientes });
    }

    const local = readJson(EXPEDIENTES_FILE, []);
    const expedientes = local
      .filter((e: any) => e.loteId === session.loteId)
      .map((e: any) => ({
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
        docsSubidos: (e.documentosFondeo || []).filter((d: any) => d.requerido && (d.estatus === 'SUBIDO' || d.estatus === 'APROBADO')).length,
        docsRequeridos: (e.documentosFondeo || []).filter((d: any) => d.requerido).length,
      }));

    res.json({ success: true, expedientes });
  } catch (error: any) {
    console.error('GET /api/lote/expedientes error:', error);
    res.status(500).json({ success: false, message: error?.message || 'No se pudieron cargar tus créditos.' });
  }
});

// 4. Lotes de Autos
app.get('/api/lotes', async (req, res) => {
  try {
    const session = getSession(req);

    if (supabaseConfigured()) {
      const lotes = await getSupabaseLotes();

      if (!session) {
        return res.json({ success: true, lotes: (lotes || []).map(sanitizeLoteForPublic) });
      }

      // Expedientes todavía pueden estar en la migración local; conservamos sus
      // estadísticas para no romper la pantalla mientras migramos expedientes.
      const expedientes = readJson(EXPEDIENTES_FILE, []);
      const lotesWithStats = (lotes || []).map((l: any) => {
        const exps = expedientes.filter((e: any) => e.loteNombre === l.nombre || e.loteId === l.id);
        const fondeados = exps.filter((e: any) => e.estatus === 'FONDEADO').length;
        return { ...l, totalExpedientes: exps.length, totalFondeados: fondeados };
      });

      return res.json({ success: true, lotes: lotesWithStats });
    }

    const lotes = readJson(LOTES_FILE, DEFAULT_LOTES);
    const expedientes = readJson(EXPEDIENTES_FILE, []);

    if (!session) {
      return res.json({ success: true, lotes: lotes.map(sanitizeLoteForPublic) });
    }

    const lotesWithStats = lotes.map((l: any) => {
      const exps = expedientes.filter((e: any) => e.loteId === l.id || e.loteNombre === l.nombre);
      const fondeados = exps.filter((e: any) => e.estatus === 'FONDEADO').length;
      return { ...l, totalExpedientes: exps.length, totalFondeados: fondeados };
    });

    return res.json({ success: true, lotes: lotesWithStats });
  } catch (error: any) {
    console.error('GET /api/lotes error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'No se pudieron cargar los lotes.' });
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
    if (supabaseConfigured()) {
      const { data: existing, error: findError } = await supabase
        .from('lotes')
        .select('*')
        .ilike('nombre', nombreLote)
        .limit(1);

      if (findError) throw new Error(`Supabase lotes: ${findError.message}`);

      if (existing && existing.length > 0) {
        return res.status(409).json({ success: false, message: 'Ya existe un lote con ese nombre.', lote: mapSupabaseLote(existing[0]) });
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

      const newLote = mapSupabaseLote(data);
      return res.json({ success: true, lote: newLote, message: 'Lote registrado correctamente en Supabase.' });
    }

    const lotes = readJson(LOTES_FILE, DEFAULT_LOTES);
    const newLote = {
      id: `lote-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      nombre: nombreLote,
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
    return res.json({ success: true, lote: newLote, message: 'Lote registrado con éxito.' });
  } catch (error: any) {
    console.error('POST /api/lotes error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'No se pudo registrar el lote.' });
  }
});

app.delete('/api/lotes/:id', async (req, res) => {
  if (!requireStaff(req, res)) return;

  try {
    if (supabaseConfigured()) {
      const { data: lote, error: findError } = await supabase
        .from('lotes')
        .select('*')
        .eq('id', req.params.id)
        .maybeSingle();

      if (findError) throw new Error(`Supabase lotes: ${findError.message}`);
      if (!lote) return res.status(404).json({ success: false, message: 'Lote no encontrado.' });

      const expedientes = readJson(EXPEDIENTES_FILE, []);
      const hasLocalExpedientes = expedientes.some((e: any) => e.loteId === lote.id || e.loteNombre === lote.nombre);
      if (hasLocalExpedientes) {
        return res.status(409).json({ success: false, message: 'No puedes eliminar un lote que ya tiene expedientes asociados.' });
      }

      const { error } = await supabase.from('lotes').delete().eq('id', req.params.id);
      if (error) throw new Error(`Supabase lotes: ${error.message}`);

      return res.json({ success: true, message: 'Lote eliminado correctamente de Supabase.' });
    }

    const lotes = readJson(LOTES_FILE, DEFAULT_LOTES);
    const index = lotes.findIndex((l: any) => l.id === req.params.id);
    if (index < 0) return res.status(404).json({ success: false, message: 'Lote no encontrado.' });

    const lote = lotes[index];
    const expedientes = readJson(EXPEDIENTES_FILE, []);
    const hasExpedientes = expedientes.some((e: any) => e.loteId === lote.id || e.loteNombre === lote.nombre);
    if (hasExpedientes) {
      return res.status(409).json({ success: false, message: 'No puedes eliminar un lote que ya tiene expedientes asociados.' });
    }

    lotes.splice(index, 1);
    writeJson(LOTES_FILE, lotes);
    return res.json({ success: true, message: 'Lote eliminado correctamente.' });
  } catch (error: any) {
    console.error('DELETE /api/lotes error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'No se pudo eliminar el lote.' });
  }
});

// Securely serve persisted expedition documents. Files never live inside expedientes.json.
app.get('/api/expedientes/:id/documentos/:filename', (req, res) => {
  const session = getSession(req);
  const accessToken = typeof req.query.accessToken === 'string' ? req.query.accessToken : '';
  const staffSession = session && (session.role === 'admin' || session.role === 'asesor');
  if (!staffSession && !verifyDocumentAccessToken(accessToken, req.params.id)) {
    return res.status(401).json({ success: false, message: 'Acceso no autorizado al documento.' });
  }

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
app.get('/api/expedientes', async (req, res) => {
  if (!requireStaff(req, res)) return;
  const { q, estatus, loteId } = req.query;
  let list = supabase ? (await getSupabaseExpedientes()) || [] : readJson(EXPEDIENTES_FILE, []);
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

  list = list.map((exp: any) => decorateExpedienteDocumentUrls(exp));
  res.json({ success: true, count: list.length, expedientes: list });
});

app.get('/api/expedientes/:id', async (req, res) => {
  if (!requireStaff(req, res)) return;
  const expedientes = supabase ? (await getSupabaseExpedientes()) || [] : readJson(EXPEDIENTES_FILE, []);
  const item = expedientes.find((e: any) => e.id === req.params.id || e.folio === req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });
  }
  if (persistExpedienteDocuments(item)) writeJson(EXPEDIENTES_FILE, expedientes);
  res.json({ success: true, expediente: decorateExpedienteDocumentUrls(item) });
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

app.post('/api/expedientes', async (req, res) => {
  const expedientes = supabase
    ? ((await getSupabaseExpedientes()) || [])
    : readJson(EXPEDIENTES_FILE, []);

  // Generate the next folio from the highest existing folio, regardless of
  // whether Render's local filesystem was reset.
  const highestFolio = expedientes.reduce((max: number, exp: any) => {
    const match = String(exp?.folio || '').match(/EXP-\\d{4}-(\\d+)$/);
    const n = match ? Number(match[1]) : 0;
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 1000);
  const nextNum = highestFolio + 1;
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
    tasaInteresAnual: 28,
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
  if (supabase) {
    try {
      await upsertExpedienteSupabase(newExpediente);
    } catch (syncError: any) {
      console.error('Supabase: error al guardar expediente nuevo:', syncError?.message || syncError);
      return res.status(500).json({ success: false, message: 'El expediente se guardó localmente, pero no pudo sincronizarse con Supabase.' });
    }
  }

  res.status(201).json({
    success: true,
    message: 'Expediente guardado exitosamente en CrediMóvil.',
    expediente: decorateExpedienteDocumentUrls(newExpediente),
  });
});

app.put('/api/expedientes/:id', async (req, res) => {
  if (!requireStaff(req, res)) return;
  const expedientes = supabase
    ? ((await getSupabaseExpedientes()) || [])
    : readJson(EXPEDIENTES_FILE, []);
  const index = expedientes.findIndex((e: any) => e.id === req.params.id || e.folio === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });
  }

  const existing = expedientes[index];
  const updated = {
    ...existing,
    ...req.body,
    tasaInteresAnual: 28,
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
  if (!supabase) {
    writeJson(EXPEDIENTES_FILE, expedientes);
  }
  if (supabase) {
    try {
      await upsertExpedienteSupabase(updated);
    } catch (syncError: any) {
      console.error('Supabase: error al sincronizar expediente actualizado:', syncError?.message || syncError);
    }
  }

  res.json({ success: true, expediente: decorateExpedienteDocumentUrls(updated), message: 'Expediente actualizado exitosamente.' });
});

app.delete('/api/expedientes/:id', async (req, res) => {
  if (!requireStaff(req, res)) return;
  let expedientes = supabase
    ? ((await getSupabaseExpedientes()) || [])
    : readJson(EXPEDIENTES_FILE, []);
  const initialLen = expedientes.length;
  const original = expedientes.find((e: any) => e.id === req.params.id || e.folio === req.params.id);
  expedientes = expedientes.filter((e: any) => e.id !== req.params.id && e.folio !== req.params.id);

  if (expedientes.length === initialLen) {
    return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });
  }

  if (!supabase) {
    writeJson(EXPEDIENTES_FILE, expedientes);
  }
  if (supabase && original?.folio) {
    try {
      const { error: deleteError } = await supabase.from('expedientes').delete().eq('folio', original.folio);
      if (deleteError) {
        console.error('Supabase: error al eliminar expediente:', deleteError.message);
      }
    } catch (syncError: any) {
      console.error('Supabase: error al eliminar expediente:', syncError?.message || syncError);
    }
  }
  const uploadDir = path.join(UPLOADS_DIR, sanitizeFileName(req.params.id));
  if (fs.existsSync(uploadDir)) fs.rmSync(uploadDir, { recursive: true, force: true });
  res.json({ success: true, message: 'Expediente eliminado con éxito.' });
});

// 6. Subida de Documentos (PNG, JPG, PDF)
app.post('/api/expedientes/:id/fondeo-doc', (req, res) => {
  if (!requireStaff(req, res)) return;
  const { docId, archivoUrl, archivoNombre, archivoTamano, subidoPor } = req.body;
  const expedientes = supabase
    ? ((await getSupabaseExpedientes()) || [])
    : readJson(EXPEDIENTES_FILE, []);
  const exp = expedientes.find((e: any) => e.id === req.params.id || e.folio === req.params.id);

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

  if (supabase) {
    try {
      await upsertExpedienteSupabase(exp);
    } catch (syncError: any) {
      console.error('Supabase: error al sincronizar documento de fondeo:', syncError?.message || syncError);
    }
  } else {
    writeJson(EXPEDIENTES_FILE, expedientes);
  }

  res.json({
    success: true,
    message: `Documento "${doc.nombre}" subido exitosamente en CrediMóvil.`,
    documentosFondeo: exp.documentosFondeo,
    expedienteEstatus: exp.estatus,
  });
});

// 7. Asesor aprueba o rechaza documento
app.put('/api/expedientes/:id/fondeo-doc-review', (req, res) => {
  if (!requireStaff(req, res)) return;
  const { docId, estatus, observaciones } = req.body;
  const expedientes = supabase
    ? ((await getSupabaseExpedientes()) || [])
    : readJson(EXPEDIENTES_FILE, []);
  const exp = expedientes.find((e: any) => e.id === req.params.id || e.folio === req.params.id);

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
  if (supabase) {
    try {
      await upsertExpedienteSupabase(exp);
    } catch (syncError: any) {
      console.error('Supabase: error al sincronizar revisión de documento:', syncError?.message || syncError);
    }
  } else {
    writeJson(EXPEDIENTES_FILE, expedientes);
  }

  res.json({
    success: true,
    message: `Estatus del documento actualizado a ${estatus}.`,
    expediente: decorateExpedienteDocumentUrls(exp),
  });
});

// 8. Estadísticas
app.get('/api/stats', async (req, res) => {
  if (!requireStaff(req, res)) return;
  const expedientes = supabase ? (await getSupabaseExpedientes()) || [] : readJson(EXPEDIENTES_FILE, []);

  const total = expedientes.length;
  const nuevos = expedientes.filter((e: any) => e.estatus === 'NUEVO').length;
  const preAprobados = expedientes.filter((e: any) => e.estatus === 'PRE_APROBADO').length;
  const enEvaluacion = expedientes.filter((e: any) => e.estatus === 'EN_EVALUACION').length;
  const aprobados = expedientes.filter((e: any) => e.estatus === 'APROBADO').length;
  const contratos = expedientes.filter((e: any) => e.estatus === 'CONTRATO').length;
  const gps = expedientes.filter((e: any) => e.estatus === 'GPS').length;
  const fondeo = expedientes.filter((e: any) =>
    e.estatus === 'FONDEO' ||
    e.estatus === 'FONDEO_PENDIENTE' ||
    e.estatus === 'FONDEO_REVISION' ||
    e.estatus === 'FONDEADO'
  ).length;
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
      preAprobados,
      enEvaluacion,
      aprobados,
      contratos,
      gps,
      fondeo,
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
  if (supabaseConfigured()) {
    console.log('Supabase configurado. Sincronizando lotes locales...');
    await ensureLegacyLotesMigrated();
    await ensureLegacyExpedientesMigrated();
  } else {
    console.warn('Supabase no configurado: usando persistencia local de lotes.');
  }

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
