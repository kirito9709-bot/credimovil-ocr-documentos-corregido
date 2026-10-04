import React, { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, FileSpreadsheet, Loader2, ScanLine, TrendingDown, TrendingUp } from 'lucide-react';
import { ExpedienteCredito, EstadosCuentaAnalisisDetalle } from '../types';
import { api } from '../services/api';

interface Props {
  expediente: ExpedienteCredito;
  onUpdate?: (updated: ExpedienteCredito) => void;
}

const DOC_TYPES = [
  { tipo: 'ESTADO_CUENTA_MES1', label: 'Estado de cuenta — Mes 1' },
  { tipo: 'ESTADO_CUENTA_MES2', label: 'Estado de cuenta — Mes 2' },
  { tipo: 'ESTADO_CUENTA_MES3', label: 'Estado de cuenta — Mes 3' },
];

export const EstadosCuentaOCRPanel: React.FC<Props> = ({ expediente, onUpdate }) => {
  const [analizando, setAnalizando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const analysis = expediente.estadosCuentaAnalisis;
  const resumen = analysis?.resumen;

  const disponibles = useMemo(() => ({
    ESTADO_CUENTA_MES1: Boolean(expediente.estadosCuenta?.mes1Url),
    ESTADO_CUENTA_MES2: Boolean(expediente.estadosCuenta?.mes2Url),
    ESTADO_CUENTA_MES3: Boolean(expediente.estadosCuenta?.mes3Url),
    ESTADO_CUENTA_CONSOLIDADO: Boolean(expediente.estadosCuenta?.archivoConsolidadoUrl),
  }), [expediente]);

  const analyze = async () => {
    const tipos = DOC_TYPES.filter((d) => disponibles[d.tipo as keyof typeof disponibles]).map((d) => d.tipo);
    if (!tipos.length && !disponibles.ESTADO_CUENTA_CONSOLIDADO) {
      alert('No hay estados de cuenta almacenados. Sube primero los documentos desde el expediente.');
      return;
    }
    setAnalizando(true);
    setMensaje(null);
    try {
      const response = await api.analyzeEstadosCuenta(expediente.id, tipos.length ? tipos : ['ESTADO_CUENTA_CONSOLIDADO']);
      if (response.success) {
        setMensaje('OCR terminado. Los ingresos y egresos quedaron guardados en Supabase.');
        if (response.expediente) onUpdate?.(response.expediente);
        else if (response.analysis) onUpdate?.({ ...expediente, estadosCuentaAnalisis: response.analysis });
      }
    } catch (err: any) {
      setMensaje(err.message || 'No se pudo completar el OCR.');
    } finally {
      setAnalizando(false);
    }
  };

  const downloadExcel = async () => {
    setDescargando(true);
    try {
      await api.downloadEstadosCuentaExcel(expediente.id, expediente.folio);
    } catch (err: any) {
      alert(err.message || 'No se pudo generar el Excel.');
    } finally {
      setDescargando(false);
    }
  };

  const detailEntries = Object.entries(analysis?.meses || {}) as Array<[string, EstadosCuentaAnalisisDetalle & { nombreArchivo?: string }]>;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-[#1C2541] border border-[#2E3A59] p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-red-400" />
              <h3 className="text-base sm:text-lg font-black text-white">Análisis OCR de Estados de Cuenta</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Lee los estados almacenados en Supabase, separa ingresos y egresos y guarda el resultado dentro del expediente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={analyze} disabled={analizando} className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-2">
              {analizando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
              {analizando ? 'Analizando...' : 'Leer con OCR'}
            </button>
            <button type="button" onClick={downloadExcel} disabled={descargando || !analysis?.movimientos?.length} className="py-2.5 px-4 rounded-xl bg-[#0B132B] hover:bg-[#2E3A59] disabled:opacity-40 border border-[#2E3A59] text-white text-xs font-bold inline-flex items-center gap-2">
              {descargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 text-emerald-400" />}
              Descargar Excel
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          {DOC_TYPES.map((doc) => (
            <div key={doc.tipo} className="rounded-xl bg-[#121824] border border-[#2E3A59] p-4">
              <div className="text-xs font-bold text-slate-300">{doc.label}</div>
              <div className={disponibles[doc.tipo as keyof typeof disponibles] ? 'text-emerald-400 text-[11px] mt-2 font-bold' : 'text-slate-500 text-[11px] mt-2'}>
                {disponibles[doc.tipo as keyof typeof disponibles] ? 'Documento disponible' : 'Sin documento'}
              </div>
            </div>
          ))}
        </div>

        {mensaje && <div className="mt-4 text-xs rounded-xl border border-[#2E3A59] bg-[#121824] p-3 text-slate-300">{mensaje}</div>}
      </div>

      {analysis?.validacionGlobal && (
        <div className={analysis.validacionGlobal.estado === 'OK'
          ? 'rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4'
          : 'rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4'}>
          <div className="flex items-center gap-2">
            {analysis.validacionGlobal.estado === 'OK'
              ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              : <AlertTriangle className="w-5 h-5 text-amber-400" />}
            <div>
              <div className="text-sm font-black text-white">
                Validación financiera: {analysis.validacionGlobal.estado === 'OK' ? 'OK' : 'REVISAR'}
              </div>
              <div className="text-[11px] text-slate-300 mt-1">
                {analysis.validacionGlobal.documentosOK}/{analysis.validacionGlobal.documentos} documento(s) sin inconsistencias de saldo.
              </div>
            </div>
          </div>
          {analysis.validacionGlobal.inconsistencias?.length > 0 && (
            <div className="mt-3 space-y-1 text-[11px] text-amber-200">
              {analysis.validacionGlobal.inconsistencias.slice(0, 5).map((item, index) => (
                <div key={index}>• {item}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-[#1C2541] border border-emerald-500/20 p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase text-slate-400"><TrendingUp className="w-4 h-4 text-emerald-400" /> Ingresos</div>
          <div className="text-2xl font-black text-emerald-400 mt-2">${(resumen?.ingresos || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="rounded-2xl bg-[#1C2541] border border-red-500/20 p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase text-slate-400"><TrendingDown className="w-4 h-4 text-red-400" /> Egresos</div>
          <div className="text-2xl font-black text-red-400 mt-2">${(resumen?.egresos || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="rounded-2xl bg-[#1C2541] border border-blue-500/20 p-4">
          <div className="text-[11px] uppercase text-slate-400">Flujo neto</div>
          <div className="text-2xl font-black text-blue-400 mt-2">${(resumen?.diferencia || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      {analysis && detailEntries.map(([key, detail]) => (
        <div key={key} className="rounded-2xl bg-[#1C2541] border border-[#2E3A59] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2E3A59] flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-white">{DOC_TYPES.find((d) => d.tipo === key)?.label || key}</div>
              <div className="text-[11px] text-slate-500">
                {detail.nombreArchivo || 'Documento'} · {detail.movimientos?.length || 0} movimientos · {detail.filasLeidas || detail.movimientos?.length || 0} filas leídas
              </div>
            </div>
            <div className="flex items-center gap-3">
              {detail.validacion && (
                <span className={detail.validacion.estado === 'OK' ? 'text-emerald-400 text-[10px] font-black uppercase' : 'text-amber-400 text-[10px] font-black uppercase'}>
                  {detail.validacion.estado === 'OK' ? '✓ SALDOS OK' : '⚠ REVISAR'}
                </span>
              )}
              <span className="text-xs font-bold text-slate-300">
                ${((detail.resumen?.ingresos || 0) - (detail.resumen?.egresos || 0)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
