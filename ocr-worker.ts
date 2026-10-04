import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { deleteOcrMessage, readOcrJob, OCR_QUEUE_NAME } from './server/ocr/jobQueue';

dotenv.config();

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_SECRET_KEY = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const TARGET_URL = String(process.env.CREDIMOVIL_BASE_URL || '').replace(/\/$/, '');
const WORKER_SECRET = String(process.env.OCR_WORKER_SECRET || '').trim();

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error('Worker OCR: configura SUPABASE_URL y SUPABASE_SECRET_KEY.');
}
if (!TARGET_URL || !WORKER_SECRET) {
  throw new Error('Worker OCR: configura CREDIMOVIL_BASE_URL y OCR_WORKER_SECRET.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function processMessage(row: any) {
  const message = typeof row?.message === 'string' ? JSON.parse(row.message) : (row?.message || {});
  const jobId = String(message.jobId || '');
  const expedienteId = String(message.expedienteId || '');
  const tipos = Array.isArray(message.tipos) ? message.tipos : [];
  const messageId = Number(row.msg_id || row.message_id || 0);

  if (!jobId || !expedienteId || !messageId) {
    throw new Error('Mensaje OCR inválido: faltan jobId, expedienteId o msg_id.');
  }

  console.log(`[CrediMóvil OCR Worker] Procesando job=${jobId} expediente=${expedienteId} queue=${OCR_QUEUE_NAME}`);

  const response = await fetch(`${TARGET_URL}/api/expedientes/${encodeURIComponent(expedienteId)}/estados-cuenta/ocr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-credimovil-ocr-worker-secret': WORKER_SECRET,
    },
    body: JSON.stringify({ tipos, jobId }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success !== true) {
    throw new Error(body?.message || `Servidor OCR respondió HTTP ${response.status}`);
  }

  await deleteOcrMessage(supabase, messageId);
  console.log(`[CrediMóvil OCR Worker] Job ${jobId} terminado y mensaje ${messageId} eliminado.`);
}

async function run() {
  console.log(`[CrediMóvil OCR Worker] Iniciado. Cola: ${OCR_QUEUE_NAME}`);

  while (true) {
    try {
      const row = await readOcrJob(supabase, 600);
      if (!row) {
        await sleep(1500);
        continue;
      }

      try {
        await processMessage(row);
      } catch (error: any) {
        console.error('[CrediMóvil OCR Worker] Error procesando mensaje:', error?.message || error);
        // No se elimina el mensaje. Al vencer el visibility timeout volverá a estar disponible.
        await sleep(1000);
      }
    } catch (error: any) {
      console.error('[CrediMóvil OCR Worker] Error de cola:', error?.message || error);
      await sleep(5000);
    }
  }
}

run().catch((error) => {
  console.error('[CrediMóvil OCR Worker] Error fatal:', error);
  process.exit(1);
});