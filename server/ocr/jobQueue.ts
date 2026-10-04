import type { SupabaseClient } from '@supabase/supabase-js';

export const OCR_QUEUE_NAME = String(process.env.OCR_QUEUE_NAME || 'credimovil-ocr').trim();

export function ocrQueueConfigured() {
  return Boolean(OCR_QUEUE_NAME && process.env.OCR_ASYNC === 'true');
}

export async function enqueueOcrJob(supabase: SupabaseClient, message: Record<string, any>) {
  const client = supabase.schema('pgmq_public');
  const { data, error } = await client.rpc('send', {
    queue_name: OCR_QUEUE_NAME,
    message,
    sleep_seconds: 0,
  });
  if (error) throw new Error('No se pudo enviar el OCR a la cola: ' + error.message);
  return Array.isArray(data) ? data[0] : data;
}

export async function readOcrJob(supabase: SupabaseClient, visibilitySeconds = 600) {
  const client = supabase.schema('pgmq_public');
  const { data, error } = await client.rpc('read', {
    queue_name: OCR_QUEUE_NAME,
    sleep_seconds: visibilitySeconds,
    n: 1,
  });
  if (error) throw new Error('No se pudo leer la cola OCR: ' + error.message);
  return Array.isArray(data) && data.length ? data[0] : null;
}

export async function deleteOcrMessage(supabase: SupabaseClient, messageId: number) {
  const client = supabase.schema('pgmq_public');
  const { data, error } = await client.rpc('delete', {
    queue_name: OCR_QUEUE_NAME,
    message_id: messageId,
  });
  if (error) throw new Error('No se pudo eliminar el mensaje OCR: ' + error.message);
  return data;
}