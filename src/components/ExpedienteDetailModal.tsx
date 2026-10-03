import React, { useEffect, useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Car,
  Building2,
  DollarSign,
  Printer,
  Share2,
  Trash2,
  Edit3,
  Save,
  Check,
  XCircle,
  Eye,
  ShieldCheck,
  Phone,
  Mail,
  ExternalLink,
  Sparkles,
  Download,
  Upload,
  Loader2,
} from 'lucide-react';
import { ExpedienteCredito, EstatusCredito } from '../types';
import { api } from '../services/api';

interface ExpedienteDetailModalProps {
  expediente: ExpedienteCredito | null;
  onClose: () => void;
  onUpdate: (updated: ExpedienteCredito) => void;
  onDelete: (id: string) => void;
  onOpenPrint: (expediente: ExpedienteCredito) => void;
}

export const ExpedienteDetailModal: React.FC<ExpedienteDetailModalProps> = ({
  expediente,
  onClose,
  onUpdate,
  onDelete,
  onOpenPrint,
}) => {
  const [activeTab, setActiveTab] = useState<'detalle' | 'fondeo' | 'fotos'>('detalle');
  const [estatus, setEstatus] = useState<EstatusCredito>(expediente?.estatus || 'NUEVO');
  const [financiera, setFinanciera] = useState(expediente?.financieraAsignada || 'CrediMóvil Auto');
  const [plazo, setPlazo] = useState(expediente?.plazoMeses || 48);
  const [precio, setPrecio] = useState(expediente?.autoPrecio || 0);
  const [engancheModo, setEngancheModo] = useState<'PORCENTAJE' | 'MONTO'>(expediente?.engancheModo || 'PORCENTAJE');
  const [engancheMonto, setEngancheMonto] = useState<number | ''>(expediente?.enganche || '');
  const [enganchePorcentaje, setEnganchePorcentaje] = useState(() => {
    const basePrecio = Number(expediente?.autoPrecio) || 0;
    const baseEnganche = Number(expediente?.enganche) || 0;
    return basePrecio > 0
      ? Math.min(100, Math.max(20, Math.round((baseEnganche / basePrecio) * 10000) / 100))
      : 20;
  });
  const [notas, setNotas] = useState(expediente?.notasAsesor || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Reviewing doc states
  const [reviewingDocId, setReviewingDocId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [previewDocTitle, setPreviewDocTitle] = useState<string>('');
  const [uploadingDocumentType, setUploadingDocumentType] = useState<string | null>(null);

  const isPdfUrl = (url?: string | null) => Boolean(url && (/^data:application\/pdf/i.test(url) || /\.pdf(?:$|[?#])/i.test(url)));

  const engancheMinimoPesos = Math.round((Number(precio) || 0) * 0.20);
  const engancheSeguro = Math.min(100, Math.max(20, Number(enganchePorcentaje) || 20));
  const engancheMontoSeguro = Math.min(Number(precio) || 0, Math.max(engancheMinimoPesos, Number(engancheMonto) || engancheMinimoPesos));
  const calcEnganche = engancheModo === 'PORCENTAJE'
    ? Math.round((Number(precio) || 0) * engancheSeguro / 100)
    : engancheMontoSeguro;
  const calcEnganchePorcentajeReal = Number(precio) > 0 ? Math.round((calcEnganche / Number(precio)) * 10000) / 100 : 0;
  const calcMontoFinanciar = Math.max(0, Number(precio) - calcEnganche);
  // Mensualidad según las cotizaciones proporcionadas:
  // capital mensual + 2.00% interés + 16% IVA sobre interés + GPS $260 + SDD $142.
  const capitalMensual = calcMontoFinanciar > 0 && plazo > 0
    ? Math.round((calcMontoFinanciar / plazo) * 100) / 100
    : 0;
  const interesMensual = Math.round(calcMontoFinanciar * 0.02 * 100) / 100;
  const ivaInteres = Math.round(interesMensual * 0.16 * 100) / 100;
  const calcMensualidad = calcMontoFinanciar > 0
    ? Math.round((capitalMensual + interesMensual + ivaInteres + 260 + 142) * 100) / 100
    : 0;

  const handleSaveTerms = async () => {
    setIsSaving(true);
    try {
      const res = await api.updateExpediente(expediente.id, {
        estatus,
        financieraAsignada: financiera,
        tasaInteresAnual: 28,
        plazoMeses: Number(plazo),
        enganche: calcEnganche,
        engancheModo,
        enganchePorcentaje: calcEnganchePorcentajeReal,
        autoPrecio: Number(precio),
        montoFinanciar: calcMontoFinanciar,
        mensualidadEstimada: calcMensualidad,
        notasAsesor: notas,
      });
      if (res.success && res.expediente) {
        onUpdate(res.expediente);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (err: any) {
      alert(err.message || 'Error al guardar cambios');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadAnalysisDocument = async (
    event: React.ChangeEvent<HTMLInputElement>,
    tipo: string,
    displayName: string,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const maxSize = 15 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('El archivo supera el límite de 15 MB.');
      return;
    }

    setUploadingDocumentType(tipo);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('No se pudo leer el archivo.'));
        reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
        reader.readAsDataURL(file);
      });

      const res = await api.uploadExpedienteDocument(expediente.id, {
        tipo,
        archivoData: dataUrl,
        archivoNombre: file.name,
        displayName,
      });

      if (res.success && res.expediente) {
        onUpdate(res.expediente);
      }
    } catch (err: any) {
      alert(err.message || `No se pudo subir ${displayName}.`);
    } finally {
      setUploadingDocumentType(null);
    }
  };

  const handleDocReview = async (docId: string, docStatus: 'APROBADO' | 'RECHAZADO') => {
    try {
      const res = await api.reviewFondeoDoc(expediente.id, {
        docId,
        estatus: docStatus,
        observaciones: docStatus === 'RECHAZADO' ? reviewComment : '',
      });
      if (res.success && res.expediente) {
        onUpdate(res.expediente);
        setReviewingDocId(null);
        setReviewComment('');
      }
    } catch {
      alert('Error al calificar documento');
    }
  };

  const openWhatsAppToLote = () => {
    const text = `*Actualización CrediMóvil - Expediente ${expediente.folio}*\n` +
      `Cliente: *${expediente.ine?.nombreCompleto || expediente.ine?.nombre}*\n` +
      `Estatus Actual: *${estatus}*\n` +
      `Monto Fondeo al Lote: *$${calcMontoFinanciar.toLocaleString('es-MX')} MXN*\n` +
      `Checklist de Documentos: ${window.location.origin}/?tab=fondeo&folio=${expediente.folio}&pin=${expediente.pinFondeo}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Sync editable values when the selected expediente changes.
  useEffect(() => {
    if (!expediente) return;
    setActiveTab('detalle');
    setEstatus(expediente.estatus);
    setFinanciera(expediente.financieraAsignada || 'CrediMóvil Auto');
    setEngancheModo(expediente.engancheModo || 'PORCENTAJE');
    setEngancheMonto(expediente.enganche || '');
    setPlazo(expediente.plazoMeses || 48);
    setPrecio(expediente.autoPrecio || 0);
    const basePrecio = Number(expediente.autoPrecio) || 0;
    const baseEnganche = Number(expediente.enganche) || 0;
    setEnganchePorcentaje(
      basePrecio > 0 ? Math.min(100, Math.max(20, Math.round((baseEnganche / basePrecio) * 100))) : 20
    );
    setNotas(expediente.notasAsesor || '');
    setSaveSuccess(false);
    setReviewingDocId(null);
    setReviewComment('');
    setPreviewDocUrl(null);
    setPreviewDocTitle('');
  }, [expediente?.id]);

  if (!expediente) return null;

  const ine = expediente.ine || {};
  const dom = ine.domicilio || {};

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-4 backdrop-blur-md overflow-y-auto"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-8 max-h-[92vh]">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800 gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xl font-mono font-black text-red-500">
              {expediente.folio}
            </span>
            <span
              className={`px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                estatus === 'FONDEADO' || estatus === 'FONDEO'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : estatus === 'GPS'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : estatus === 'CONTRATO'
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                  : estatus === 'APROBADO'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : estatus === 'PRE_APROBADO'
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : estatus === 'FONDEO_REVISION'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {estatus}
            </span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              PIN Lote: <strong className="text-amber-400 font-mono">{expediente.pinFondeo}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenPrint(expediente)}
              className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition flex items-center gap-1.5 border border-slate-700"
              title="Generar carátula imprimible"
            >
              <Printer className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Carátula CrediMóvil</span>
            </button>

            <button
              onClick={openWhatsAppToLote}
              className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-md shadow-emerald-900/30"
              title="Notificar estatus al lote"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            <button
              onClick={() => {
                if (confirm(`¿Estás seguro de eliminar el expediente ${expediente.folio}?`)) {
                  onDelete(expediente.id);
                  onClose();
                }
              }}
              className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-950/60 rounded-xl transition border border-rose-900/40"
              title="Eliminar expediente"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-navigation tabs */}
        <div className="flex items-center gap-2 px-6 py-2 bg-slate-900 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('detalle')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'detalle'
                ? 'bg-red-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Ficha del Cliente & Crédito
          </button>

          <button
            onClick={() => setActiveTab('fondeo')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'fondeo'
                ? 'bg-red-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Documentos CrediMóvil</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-black/40 text-white">
              {expediente.documentosFondeo?.filter((d) => d.estatus === 'SUBIDO').length || 0} pendientes
            </span>
          </button>

          <button
            onClick={() => setActiveTab('fotos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'fotos'
                ? 'bg-red-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Documentos para Análisis (INE, Domicilio, 3 Meses)
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'detalle' && (
            <>
              {/* Dictamen panel */}
              <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-red-500" />
                    Dictamen CrediMóvil & Condiciones
                  </h3>

                  <div className="flex items-center gap-2">
                    {saveSuccess && (
                      <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Guardado exitosamente
                      </span>
                    )}
                    <button
                      onClick={handleSaveTerms}
                      disabled={isSaving}
                      className="py-1.5 px-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-md shadow-red-900/30"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Estatus de Solicitud</label>
                    <select
                      value={estatus}
                      onChange={(e) => setEstatus(e.target.value as EstatusCredito)}
                      className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:border-red-500"
                    >
                      <option value="NUEVO">NUEVO</option>
                      <option value="PRE_APROBADO">PRE-APROBADO</option>
                      <option value="EN_EVALUACION">EN ANÁLISIS</option>
                      <option value="APROBADO">APROBADO</option>
                      <option value="CONTRATO">CONTRATO</option>
                      <option value="GPS">GPS</option>
                      <option value="FONDEO">FONDEO</option>
                      <option value="FONDEO_REVISION">FONDEO EN REVISIÓN</option>
                      <option value="FONDEADO">FONDEADO / DISPERSADO</option>
                      <option value="RECHAZADO">RECHAZADO</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Financiera Asignada</label>
                    <select
                      value={financiera}
                      onChange={(e) => setFinanciera(e.target.value)}
                      className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:border-red-500"
                    >
                      <option value="CrediMóvil Auto">CrediMóvil Auto</option>
                      <option value="BBVA Auto">BBVA Auto</option>
                      <option value="Santander Auto">Santander Auto</option>
                      <option value="Banorte Auto">Banorte Auto</option>
                      <option value="Hey Banco Auto">Hey Banco Auto</option>
                      <option value="Scotiabank Auto">Scotiabank Auto</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Tasa Anual (%)</label>
                    <div className="w-full py-2 px-3 bg-slate-900 border border-emerald-500/30 rounded-xl text-emerald-400 font-black">
                      28%
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs mt-4 pt-4 border-t border-slate-800">
                  <div>
                    <label className="block text-slate-400 mb-1">Precio Auto ($MXN)</label>
                    <input
                      type="number"
                      value={precio}
                      onChange={(e) => setPrecio(Number(e.target.value))}
                      className="w-full py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Enganche</label>
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEngancheModo('PORCENTAJE');
                          if (!enganchePorcentaje) setEnganchePorcentaje(20);
                        }}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold border ${
                          engancheModo === 'PORCENTAJE'
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-slate-900 text-slate-400 border-slate-700'
                        }`}
                      >
                        Porcentaje
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEngancheModo('MONTO');
                          setEngancheMonto(calcEnganche);
                        }}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold border ${
                          engancheModo === 'MONTO'
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-slate-900 text-slate-400 border-slate-700'
                        }`}
                      >
                        Efectivo
                      </button>
                    </div>
                    {engancheModo === 'PORCENTAJE' ? (
                      <input
                        type="number"
                        min={20}
                        max={100}
                        step={0.01}
                        value={engancheSeguro}
                        onChange={(e) => {
                          const value = Number(e.target.value) || 20;
                          setEnganchePorcentaje(Math.min(100, Math.max(20, value)));
                        }}
                        className="w-full py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                      />
                    ) : (
                      <input
                        type="number"
                        min={engancheMinimoPesos}
                        max={Number(precio) || 0}
                        step={1000}
                        value={engancheMonto === '' ? engancheMinimoPesos : engancheMonto}
                        onChange={(e) => {
                          const value = Number(e.target.value) || engancheMinimoPesos;
                          setEngancheMonto(Math.min(Number(precio) || 0, Math.max(engancheMinimoPesos, value)));
                        }}
                        className="w-full py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                      />
                    )}
                    <div className="text-[10px] text-slate-500 mt-1">
                      Mínimo 20%: ${engancheMinimoPesos.toLocaleString('es-MX')} • Equivale a {calcEnganchePorcentajeReal}%
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Plazo (Meses)</label>
                    <select
                      value={plazo}
                      onChange={(e) => setPlazo(Number(e.target.value))}
                      className="w-full py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                    >
                      <option value={12}>12 Meses</option>
                      <option value={24}>24 Meses</option>
                      <option value={36}>36 Meses</option>
                      <option value={48}>48 Meses</option>
                      <option value={60}>60 Meses</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold text-emerald-400">
                      Monto Fondeo al Lote
                    </label>
                    <div className="py-1.5 px-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-emerald-300 font-bold">
                      ${calcMontoFinanciar.toLocaleString('es-MX')} MXN
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-slate-400 mb-1 text-xs font-semibold">Notas del Asesor CrediMóvil</label>
                  <textarea
                    rows={2}
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Comentarios sobre buró, capacidad de pago o aclaraciones para el lote..."
                    className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* Informacion de Solicitante y Auto */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3 text-xs">
                  <h4 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
                    Cliente (Cotejo Oficial INE)
                  </h4>
                  <p>
                    <span className="text-slate-400">Nombre:</span>{' '}
                    <strong className="text-white font-semibold">
                      {ine.nombreCompleto || `${ine.nombre || ''} ${ine.primerApellido || ''} ${ine.segundoApellido || ''}`}
                    </strong>
                  </p>
                  <p>
                    <span className="text-slate-400">CURP:</span>{' '}
                    <strong className="text-red-400 font-mono">{ine.curp || 'N/A'}</strong>
                  </p>
                  <p>
                    <span className="text-slate-400">RFC del Cliente:</span>{' '}
                    <strong className="text-amber-400 font-mono font-bold tracking-wider">
                      {ine.rfc || (ine.curp ? ine.curp.substring(0, 10) : 'N/A')}
                    </strong>
                  </p>
                  <p>
                    <span className="text-slate-400">
                      {expediente.domicilioCoincideConIne === false ? 'Domicilio Actual (Comprobante Agua/Luz):' : 'Domicilio Oficial (INE):'}
                    </span>{' '}
                    <span className="text-slate-300">
                      {dom.domicilioCompleto || `${dom.calle || ''} #${dom.numExterior || ''}, Col. ${dom.colonia || ''}, C.P. ${dom.codigoPostal || ''}`}
                    </span>
                  </p>
                  {expediente.comprobanteDomicilioActualUrl && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewDocUrl(expediente.comprobanteDomicilioActualUrl || null);
                          setPreviewDocTitle(`Comprobante Domicilio - ${expediente.comprobanteDomicilioActualNombre || 'Agua / Luz'}`);
                        }}
                        className="py-1 px-2.5 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 text-amber-300 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver Comprobante de Domicilio (Agua / Luz CFE)
                      </button>
                    </div>
                  )}
                  <p className="flex items-center gap-4 pt-1">
                    <span>
                      <Phone className="w-3.5 h-3.5 inline mr-1 text-red-400" />
                      <strong className="text-white">{expediente.telefono || 'N/A'}</strong>
                    </span>
                    {expediente.correo && (
                      <span>
                        <Mail className="w-3.5 h-3.5 inline mr-1 text-red-400" />
                        <span className="text-slate-300">{expediente.correo}</span>
                      </span>
                    )}
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3 text-xs">
                  <h4 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
                    Vehículo & Fondeo Lote
                  </h4>
                  <p>
                    <span className="text-slate-400">Lote:</span>{' '}
                    <strong className="text-white font-semibold">{expediente.loteNombre}</strong>
                  </p>
                  <p>
                    <span className="text-slate-400">Vehículo:</span>{' '}
                    <strong className="text-red-400">
                      {expediente.autoMarca} {expediente.autoModelo} ({expediente.autoAno})
                    </strong>
                  </p>
                  {expediente.esVehiculoLegalizado && (
                    <p>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Vehículo Legalizado (Requiere Título & Pedimento)
                      </span>
                    </p>
                  )}
                  <p>
                    <span className="text-slate-400">CLABE Dispersión:</span>{' '}
                    <span className="font-mono text-slate-300">{expediente.cuentaClabeLote || 'Pendiente de registrar por el lote'}</span>
                  </p>
                  <p>
                    <span className="text-slate-400">Banco Receptor:</span>{' '}
                    <span className="text-slate-300">{expediente.bancoLote || 'Por asignar'}</span>
                  </p>
                </div>
              </div>
            </>
          )}

          {activeTab === 'fondeo' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-red-950/20 border border-red-500/20 text-xs text-red-200 flex items-center justify-between">
                <div>
                  <p className="font-bold">Checklist de Documentos CrediMóvil</p>
                  <p className="text-[11px] text-slate-300">
                    Evalúa la papelería subida por el lote (Factura, Consecutivos, Endosos, Refrendos 5 años, Título/Pedimento si legalizado).
                  </p>
                </div>

                <button
                  onClick={openWhatsAppToLote}
                  className="py-1.5 px-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition shrink-0"
                >
                  Enviar Link al Lote
                </button>
              </div>

              <div className="space-y-3">
                {(expediente.documentosFondeo || []).map((doc, idx) => {
                  const isUnderReview = reviewingDocId === doc.id;

                  return (
                    <div
                      key={doc.id}
                      className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-bold text-white">{doc.nombre}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                doc.estatus === 'APROBADO'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : doc.estatus === 'SUBIDO'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : doc.estatus === 'RECHAZADO'
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {doc.estatus}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 pl-7">{doc.descripcion}</p>

                          {doc.archivoNombre && (
                            <p className="text-xs text-slate-300 pl-7">
                              Archivo: <strong>{doc.archivoNombre}</strong> • {doc.archivoTamano || 'Cargado'}
                            </p>
                          )}
                          {doc.observaciones && (
                            <p className="text-xs text-rose-300 pl-7">
                              Observación previa: {doc.observaciones}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pl-7 sm:pl-0 shrink-0">
                          {doc.archivoUrl && (
                            <button
                              onClick={() => {
                                setPreviewDocUrl(doc.archivoUrl || null);
                                setPreviewDocTitle(doc.nombre);
                              }}
                              className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700"
                            >
                              <Eye className="w-3.5 h-3.5 text-red-400" />
                              Ver PNG / PDF
                            </button>
                          )}

                          {doc.archivoUrl ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleDocReview(doc.id, 'APROBADO')}
                                className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Aprobar
                              </button>

                              <button
                                onClick={() => setReviewingDocId(isUnderReview ? null : doc.id)}
                                className="py-1.5 px-2.5 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 rounded-xl text-xs font-medium transition"
                              >
                                Rechazar
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500 italic">Sin archivo aún</span>
                          )}
                        </div>
                      </div>

                      {isUnderReview && (
                        <div className="p-3 bg-rose-950/30 border border-rose-800/40 rounded-xl space-y-2">
                          <label className="block text-xs font-semibold text-rose-300">
                            Motivo de observación para que el lote lo reemplace:
                          </label>
                          <input
                            type="text"
                            value={reviewComment}
                            onChange={(e) => setReviewComment(e.target.value)}
                            placeholder="ej. Factura sin endoso / Documento ilegible"
                            className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500"
                          />
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              onClick={() => setReviewingDocId(null)}
                              className="py-1 px-3 text-slate-400 hover:text-white text-xs"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleDocReview(doc.id, 'RECHAZADO')}
                              disabled={!reviewComment.trim()}
                              className="py-1 px-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs"
                            >
                              Confirmar Observación
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'fotos' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/20">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">Agregar / Reemplazar documentos después del alta</h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Puedes subir posteriormente la INE, comprobante de domicilio y estados de cuenta sin crear un nuevo folio.
                    </p>
                  </div>
                  <Upload className="w-5 h-5 text-emerald-400 shrink-0" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    ['INE_FRENTE', 'INE Frente'],
                    ['INE_REVERSO', 'INE Reverso'],
                    ['COMPROBANTE_DOMICILIO', 'Comprobante de domicilio'],
                    ['ESTADO_CUENTA_MES1', 'Estado de cuenta Mes 1'],
                    ['ESTADO_CUENTA_MES2', 'Estado de cuenta Mes 2'],
                    ['ESTADO_CUENTA_MES3', 'Estado de cuenta Mes 3'],
                    ['ESTADO_CUENTA_CONSOLIDADO', 'Estados de cuenta 3 meses (PDF)'],
                  ].map(([tipo, label]) => (
                    <div key={tipo} className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <input
                        id={`upload-doc-${tipo}`}
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => handleUploadAnalysisDocument(e, tipo, label)}
                      />
                      <label
                        htmlFor={`upload-doc-${tipo}`}
                        className="w-full cursor-pointer py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2"
                      >
                        {uploadingDocumentType === tipo ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Subiendo...</>
                        ) : (
                          <><Upload className="w-3.5 h-3.5 text-emerald-400" /> {label}</>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* 1. INE Ambos Lados */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                  Identificación Oficial (INE Frente y Reverso)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400">Frente del INE</span>
                      {expediente.fotoIneFrente && (
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewDocUrl(expediente.fotoIneFrente || null);
                            setPreviewDocTitle('INE Frente');
                          }}
                          className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" /> Ver tamaño completo
                        </button>
                      )}
                    </div>
                    <div className="aspect-85/54 rounded-2xl border border-slate-700 bg-slate-950 overflow-hidden flex items-center justify-center">
                      {expediente.fotoIneFrente ? (
                        expediente.fotoIneFrente.startsWith('data:application/pdf') ? (
                          <div className="text-center p-4">
                            <FileText className="w-8 h-8 text-red-400 mx-auto mb-1" />
                            <span className="text-xs text-slate-300">Documento PDF Frente</span>
                          </div>
                        ) : (
                          <img
                            src={expediente.fotoIneFrente}
                            alt="INE Frente"
                            className="w-full h-full object-contain"
                          />
                        )
                      ) : (
                        <span className="text-xs text-slate-500">Sin foto de frente</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400">Reverso del INE</span>
                      {expediente.fotoIneReverso && (
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewDocUrl(expediente.fotoIneReverso || null);
                            setPreviewDocTitle('INE Reverso');
                          }}
                          className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" /> Ver tamaño completo
                        </button>
                      )}
                    </div>
                    <div className="aspect-85/54 rounded-2xl border border-slate-700 bg-slate-950 overflow-hidden flex items-center justify-center">
                      {expediente.fotoIneReverso ? (
                        expediente.fotoIneReverso.startsWith('data:application/pdf') ? (
                          <div className="text-center p-4">
                            <FileText className="w-8 h-8 text-red-400 mx-auto mb-1" />
                            <span className="text-xs text-slate-300">Documento PDF Reverso</span>
                          </div>
                        ) : (
                          <img
                            src={expediente.fotoIneReverso}
                            alt="INE Reverso"
                            className="w-full h-full object-contain"
                          />
                        )
                      ) : (
                        <span className="text-xs text-slate-500">Sin foto de reverso</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Comprobante de Domicilio */}
              <div className="pt-2 border-t border-slate-800">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                  Comprobante de Domicilio (Recibo de Agua o Luz CFE)
                </h4>
                {expediente.comprobanteDomicilioActualUrl ? (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">
                          {expediente.comprobanteDomicilioActualNombre || 'Comprobante_Agua_o_Luz'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {expediente.domicilioCoincideConIne === false
                            ? 'Domicilio validado por recibo de servicio'
                            : 'Cotejado con domicilio oficial'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setPreviewDocUrl(expediente.comprobanteDomicilioActualUrl || null);
                        setPreviewDocTitle(`Comprobante Domicilio: ${expediente.comprobanteDomicilioActualNombre || 'Recibo'}`);
                      }}
                      className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                      Ver Comprobante
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No se adjuntó comprobante separado (se utilizó la dirección del INE).</p>
                )}
              </div>

              {/* 3. Estados de Cuenta Bancarios (3 Meses) */}
              <div className="pt-2 border-t border-slate-800">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">3</span>
                  Estados de Cuenta Bancarios para Análisis (3 Meses)
                </h4>

                {expediente.estadosCuenta?.archivoConsolidadoUrl ? (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">
                          {expediente.estadosCuenta.archivoConsolidadoNombre || 'Estados_de_Cuenta_3_Meses.pdf'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Archivo PDF consolidado con los 3 meses completos
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setPreviewDocUrl(expediente.estadosCuenta?.archivoConsolidadoUrl || null);
                        setPreviewDocTitle('Estados de Cuenta - Archivo Consolidado');
                      }}
                      className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-400" />
                      Ver PDF Consolidado
                    </button>
                  </div>
                ) : (expediente.estadosCuenta?.mes1Url || expediente.estadosCuenta?.mes2Url || expediente.estadosCuenta?.mes3Url) ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Mes 1 */}
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                      <span className="text-[11px] font-bold text-slate-400 block">Mes 1 (Más reciente)</span>
                      {expediente.estadosCuenta.mes1Url ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewDocUrl(expediente.estadosCuenta?.mes1Url || null);
                            setPreviewDocTitle(`Estado de Cuenta - Mes 1 (${expediente.estadosCuenta?.mes1Nombre || 'PDF'})`);
                          }}
                          className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-red-400" /> Ver Mes 1
                        </button>
                      ) : (
                        <span className="text-xs text-slate-600 block italic">Sin archivo</span>
                      )}
                    </div>

                    {/* Mes 2 */}
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                      <span className="text-[11px] font-bold text-slate-400 block">Mes 2</span>
                      {expediente.estadosCuenta.mes2Url ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewDocUrl(expediente.estadosCuenta?.mes2Url || null);
                            setPreviewDocTitle(`Estado de Cuenta - Mes 2 (${expediente.estadosCuenta?.mes2Nombre || 'PDF'})`);
                          }}
                          className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-red-400" /> Ver Mes 2
                        </button>
                      ) : (
                        <span className="text-xs text-slate-600 block italic">Sin archivo</span>
                      )}
                    </div>

                    {/* Mes 3 */}
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                      <span className="text-[11px] font-bold text-slate-400 block">Mes 3</span>
                      {expediente.estadosCuenta.mes3Url ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewDocUrl(expediente.estadosCuenta?.mes3Url || null);
                            setPreviewDocTitle(`Estado de Cuenta - Mes 3 (${expediente.estadosCuenta?.mes3Nombre || 'PDF'})`);
                          }}
                          className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-red-400" /> Ver Mes 3
                        </button>
                      ) : (
                        <span className="text-xs text-slate-600 block italic">Sin archivo</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No se han adjuntado estados de cuenta en este expediente.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-800 pt-4 print:hidden">
        <button
          type="button"
          onClick={onClose}
          className="py-2.5 px-5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs"
        >
          Cerrar expediente
        </button>
      </div>

      {/* Preview modal for PDF & PNG */}
      {previewDocUrl && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4">
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden p-4 border border-slate-700 flex flex-col w-full">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-2">
              <h4 className="text-sm font-bold text-white">{previewDocTitle}</h4>
              <button
                onClick={() => setPreviewDocUrl(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                Cerrar
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center">
              {isPdfUrl(previewDocUrl) ? (
                <object
                  data={previewDocUrl}
                  type="application/pdf"
                  className="w-full h-[75vh] rounded"
                >
                  <p className="text-xs text-slate-400">PDF</p>
                </object>
              ) : (
                <img
                  src={previewDocUrl}
                  alt="Documento"
                  className="max-h-[75vh] object-contain rounded"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
