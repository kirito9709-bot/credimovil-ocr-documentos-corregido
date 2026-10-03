import { ExpedienteCredito, IneData, LoteAuto } from '../types';

const getAuthToken = () => localStorage.getItem('credimovil_auth_token') || '';

const authHeaders = (extra: Record<string, string> = {}) => {
  const token = getAuthToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
};

const parseError = async (res: Response, fallback: string) => {
  const err = await res.json().catch(() => ({}));
  throw new Error(err.message || fallback);
};

export const api = {
  async login(username: string, password: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) await parseError(res, 'Usuario o contraseña incorrectos.');
    return res.json() as Promise<{ success: boolean; token: string; user: { username: string; role: 'admin' | 'asesor' | 'lote'; nombre: string; loteId?: string | null } }>;
  },

  async getMe() {
    const res = await fetch('/api/auth/me', { headers: authHeaders() });
    if (!res.ok) await parseError(res, 'Sesión no válida.');
    return res.json();
  },

  async logout() {
    await fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() }).catch(() => {});
    localStorage.removeItem('credimovil_auth_token');
    localStorage.removeItem('credimovil_auth_user');
  },

  async getAsesores() {
    const res = await fetch('/api/asesores', { headers: authHeaders() });
    if (!res.ok) await parseError(res, 'No se pudieron consultar los asesores.');
    return res.json();
  },

  async createAsesor(data: { username: string; password: string; nombre: string }) {
    const res = await fetch('/api/asesores', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) await parseError(res, 'No se pudo crear el asesor.');
    return res.json();
  },

  async deleteAsesor(id: string) {
    const res = await fetch(`/api/asesores/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) await parseError(res, 'No se pudo eliminar el asesor.');
    return res.json();
  },

  async getLoteUsuarios() {
    const res = await fetch('/api/lote-usuarios', { headers: authHeaders() });
    if (!res.ok) await parseError(res, 'No se pudieron consultar los usuarios de lotes.');
    return res.json();
  },

  async createLoteUsuario(data: { loteId: string; nombre: string; username: string; password: string }) {
    const res = await fetch('/api/lote-usuarios', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) await parseError(res, 'No se pudo crear el usuario del lote.');
    return res.json();
  },

  async deleteLoteUsuario(id: string) {
    const res = await fetch(`/api/lote-usuarios/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) await parseError(res, 'No se pudo eliminar el usuario del lote.');
    return res.json();
  },

  async getLoteExpedientes() {
    const res = await fetch('/api/lote/expedientes', { headers: authHeaders() });
    if (!res.ok) await parseError(res, 'No se pudieron consultar tus créditos.');
    return res.json();
  },

  async scanIne(imageBase64: string, imageBackBase64?: string): Promise<{ success: boolean; data: IneData; message?: string }> {
    const res = await fetch('/api/ocr-ine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, imageBackBase64 }),
    });
    if (!res.ok) await parseError(res, 'Error al procesar la credencial INE');
    return res.json();
  },

  async scanComprobanteDomicilio(imageBase64: string) {
    const res = await fetch('/api/ocr-comprobante-domicilio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64 }),
    });
    if (!res.ok) await parseError(res, 'Error al procesar el comprobante de domicilio');
    return res.json();
  },

  async getExpedientes(params?: { q?: string; estatus?: string; loteId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.append('q', params.q);
    if (params?.estatus) searchParams.append('estatus', params.estatus);
    if (params?.loteId) searchParams.append('loteId', params.loteId);

    const res = await fetch(`/api/expedientes?${searchParams.toString()}`, { headers: authHeaders() });
    if (!res.ok) await parseError(res, 'Error al consultar expedientes');
    return res.json();
  },

  async getExpediente(id: string) {
    const res = await fetch(`/api/expedientes/${encodeURIComponent(id)}`, { headers: authHeaders() });
    if (!res.ok) await parseError(res, 'Expediente no encontrado');
    return res.json();
  },

  async lookupByFolio(folio: string, pinFondeo?: string) {
    const res = await fetch('/api/expedientes/by-folio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folio, pinFondeo }),
    });
    if (!res.ok) await parseError(res, 'Error al buscar el expediente');
    return res.json();
  },

  async createExpediente(data: Partial<ExpedienteCredito>) {
    const res = await fetch('/api/expedientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) await parseError(res, 'Error al guardar el expediente');
    return res.json();
  },

  async updateExpediente(id: string, data: Partial<ExpedienteCredito>) {
    const res = await fetch(`/api/expedientes/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) await parseError(res, 'Error al actualizar expediente');
    return res.json();
  },

  async deleteExpediente(id: string) {
    const res = await fetch(`/api/expedientes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) await parseError(res, 'Error al eliminar expediente');
    return res.json();
  },

  async uploadFondeoDoc(expedienteId: string, payload: { docId: string; archivoUrl: string; archivoNombre: string; archivoTamano?: string; subidoPor?: string }) {
    const res = await fetch(`/api/expedientes/${encodeURIComponent(expedienteId)}/fondeo-doc`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) await parseError(res, 'Error al subir documento de fondeo');
    return res.json();
  },

  async reviewFondeoDoc(expedienteId: string, payload: { docId: string; estatus: 'APROBADO' | 'RECHAZADO' | 'PENDIENTE'; observaciones?: string }) {
    const res = await fetch(`/api/expedientes/${encodeURIComponent(expedienteId)}/fondeo-doc-review`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) await parseError(res, 'Error al evaluar documento');
    return res.json();
  },

  async getLotes() {
    const res = await fetch('/api/lotes', { headers: authHeaders() });
    if (!res.ok) await parseError(res, 'Error al consultar lotes');
    return res.json();
  },

  async createLote(lote: Partial<LoteAuto>) {
    const res = await fetch('/api/lotes', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(lote),
    });
    if (!res.ok) await parseError(res, 'Error al registrar lote');
    return res.json();
  },

  async deleteLote(id: string) {
    const res = await fetch(`/api/lotes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) await parseError(res, 'No se pudo eliminar el lote.');
    return res.json();
  },

  async getStats() {
    const res = await fetch('/api/stats', { headers: authHeaders() });
    if (!res.ok) await parseError(res, 'Error al obtener estadísticas');
    return res.json();
  },
};
