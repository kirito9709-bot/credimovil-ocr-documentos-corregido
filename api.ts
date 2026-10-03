import { ExpedienteCredito, IneData, LoteAuto } from '../types';

export const api = {
  // OCR Call Credencial INE
  async scanIne(imageBase64: string, imageBackBase64?: string): Promise<{ success: boolean; data: IneData; message?: string }> {
    const res = await fetch('/api/ocr-ine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, imageBackBase64 }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al procesar la credencial INE');
    }
    return res.json();
  },

  // OCR Call Comprobante de Domicilio (Agua o Luz)
  async scanComprobanteDomicilio(imageBase64: string): Promise<{
    success: boolean;
    data: {
      tipoComprobante?: string;
      companiaEmisora?: string;
      nombreTitular?: string;
      fechaEmision?: string;
      esReciente?: boolean;
      calle?: string;
      numExterior?: string;
      numInterior?: string;
      colonia?: string;
      codigoPostal?: string;
      municipio?: string;
      estado?: string;
      domicilioCompleto?: string;
    };
    message?: string;
  }> {
    const res = await fetch('/api/ocr-comprobante-domicilio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64 }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al procesar el comprobante de domicilio');
    }
    return res.json();
  },

  // Expedientes
  async getExpedientes(params?: { q?: string; estatus?: string; loteId?: string }): Promise<{ success: boolean; count: number; expedientes: ExpedienteCredito[] }> {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.append('q', params.q);
    if (params?.estatus) searchParams.append('estatus', params.estatus);
    if (params?.loteId) searchParams.append('loteId', params.loteId);

    const res = await fetch(`/api/expedientes?${searchParams.toString()}`);
    if (!res.ok) throw new Error('Error al consultar expedientes');
    return res.json();
  },

  async getExpediente(id: string): Promise<{ success: boolean; expediente: ExpedienteCredito }> {
    const res = await fetch(`/api/expedientes/${id}`);
    if (!res.ok) throw new Error('Expediente no encontrado');
    return res.json();
  },

  async lookupByFolio(folio: string, pinFondeo?: string): Promise<{ success: boolean; expediente: ExpedienteCredito; message?: string }> {
    const res = await fetch('/api/expedientes/by-folio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folio, pinFondeo }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al buscar el expediente');
    }
    return res.json();
  },

  async createExpediente(data: Partial<ExpedienteCredito>): Promise<{ success: boolean; expediente: ExpedienteCredito; message: string }> {
    const res = await fetch('/api/expedientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al guardar el expediente');
    }
    return res.json();
  },

  async updateExpediente(id: string, data: Partial<ExpedienteCredito>): Promise<{ success: boolean; expediente: ExpedienteCredito; message: string }> {
    const res = await fetch(`/api/expedientes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error al actualizar expediente');
    return res.json();
  },

  async deleteExpediente(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/expedientes/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Error al eliminar expediente');
    return res.json();
  },

  // Fondeo docs
  async uploadFondeoDoc(expedienteId: string, payload: {
    docId: string;
    archivoUrl: string;
    archivoNombre: string;
    archivoTamano?: string;
    subidoPor?: string;
  }): Promise<{ success: boolean; documentosFondeo: any[]; expedienteEstatus: string; message: string }> {
    const res = await fetch(`/api/expedientes/${expedienteId}/fondeo-doc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al subir documento de fondeo');
    }
    return res.json();
  },

  async reviewFondeoDoc(expedienteId: string, payload: {
    docId: string;
    estatus: 'APROBADO' | 'RECHAZADO' | 'PENDIENTE';
    observaciones?: string;
  }): Promise<{ success: boolean; expediente: ExpedienteCredito; message: string }> {
    const res = await fetch(`/api/expedientes/${expedienteId}/fondeo-doc-review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Error al evaluar documento');
    return res.json();
  },

  // Lotes
  async getLotes(): Promise<{ success: boolean; lotes: LoteAuto[] }> {
    const res = await fetch('/api/lotes');
    if (!res.ok) throw new Error('Error al consultar lotes');
    return res.json();
  },

  async createLote(lote: Partial<LoteAuto>): Promise<{ success: boolean; lote: LoteAuto; message: string }> {
    const res = await fetch('/api/lotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lote),
    });
    if (!res.ok) throw new Error('Error al registrar lote');
    return res.json();
  },

  // Stats
  async getStats(): Promise<{
    success: boolean;
    stats: {
      total: number;
      nuevos: number;
      enEvaluacion: number;
      aprobados: number;
      fondeoRevision: number;
      fondeados: number;
      montoTotalFinanciado: number;
    };
  }> {
    const res = await fetch('/api/stats');
    if (!res.ok) throw new Error('Error al obtener estadísticas');
    return res.json();
  },

  // Admin auth
  async verifyAdminPin(pin: string): Promise<{ success: boolean; token: string; admin: { nombre: string; correo: string } }> {
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'PIN incorrecto');
    }
    return res.json();
  },

  async updateAdminConfig(payload: {
    currentPin: string;
    newPin?: string;
    asesorNombre?: string;
    telefonoContacto?: string;
    correoNotificaciones?: string;
  }): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/admin/change-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al actualizar configuración');
    }
    return res.json();
  },
};
