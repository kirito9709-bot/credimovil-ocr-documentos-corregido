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
  MessageSquare,
  Calculator,
  Users,
} from 'lucide-react';
import { ExpedienteCredito, EstatusCredito, LoteAuto } from '../types';
import { api } from '../services/api';
import { ExpedienteComentariosModal } from './ExpedienteComentariosModal';
import { CotizadorCreditoModal } from './CotizadorCreditoModal';
import { EstadosCuentaOCRPanel } from './EstadosCuentaOCRPanel';
import { AgregarObligadoModal } from './AgregarObligadoModal';

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
  const [activeTab, setActiveTab] = useState<'detalle' | 'fondeo' | 'fotos' | 'estados'>('detalle');
  const [estatus, setEstatus] = useState<EstatusCredito>(expediente?.estatus || 'NUEVO');
  const [financiera, setFinanciera] = useState(expediente?.financieraAsignada || 'CrediMóvil Auto');
  const [plazo, setPlazo] = useState(expediente?.plazoMeses || 48);
  const [autoMarca, setAutoMarca] = useState(expediente?.autoMarca || '');
  const [autoModelo, setAutoModelo] = useState(expediente?.autoModelo || '');
  const [autoAno, setAutoAno] = useState(expediente?.autoAno || '');
  const [precio, setPrecio] = useState(expediente?.autoPrecio || 0);
  const [editVehiculo, setEditVehiculo] = useState(false);
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
  const [lotesDisponibles, setLotesDisponibles] = useState<LoteAuto[]>([]);
  const [nuevoLoteId, setNuevoLoteId] = useState(expediente?.loteId || '');
  const [editLote, setEditLote] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Reviewing doc states
  const [reviewingDocId, setReviewingDocId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [previewDocTitle, setPreviewDocTitle] = useState<string>('');
  const [uploadingDocumentType, setUploadingDocumentType] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [showObligadoModal, setShowObligadoModal] = useState(false);

  const isPdfUrl = (url?: string | null) => Boolean(url && (/^data:application\/pdf/i.test(url) || /\.pdf(?:$|[?#])/i.test(url)));

  const engancheMinimoPesos = Math.round((Number(precio) || 0) * 0.20);
  const engancheSeguro = Math.min(100, Math.max(20, Number(enganchePorcentaje) || 20));
  const engancheMontoSeguro = Math.min(Number(precio) || 0, Math.max(0, Number(engancheMonto) || 0));
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
        autoMarca: autoMarca.trim(),
        autoModelo: autoModelo.trim(),
        autoAno: String(autoAno).trim(),
        autoPrecio: Number(precio),
        ...(nuevoLoteId && lotesDisponibles.find((lote) => lote.id === nuevoLoteId)
          ? (() => {
              const lote = lotesDisponibles.find((item) => item.id === nuevoLoteId)!;
              return {
                loteId: lote.id,
                loteNombre: lote.nombre,
                asesorLoteContacto: lote.contacto || '',
                telefonoLote: lote.telefono || '',
                correoLote: lote.correo || '',
              };
            })()
          : {}),
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
    setAutoMarca(expediente.autoMarca || '');
    setAutoModelo(expediente.autoModelo || '');
    setAutoAno(expediente.autoAno || '');
    setEditVehiculo(false);
    setPrecio(expediente.autoPrecio || 0);
    const basePrecio = Number(expediente.autoPrecio) || 0;
    const baseEnganche = Number(expediente.enganche) || 0;
    setEnganchePorcentaje(
      basePrecio > 0 ? Math.min(100, Math.max(20, Math.round((baseEnganche / basePrecio) * 10000) / 100)) : 20
    );
    setNotas(expediente.notasAsesor || '');
    setNuevoLoteId(expediente.loteId || '');
    setEditLote(false);
    setSaveSuccess(false);
    setReviewingDocId(null);
    setReviewComment('');
    setPreviewDocUrl(null);
    setPreviewDocTitle('');
  }, [expediente?.id]);

  useEffect(() => {
    if (!expediente) return;
    let cancelled = false;
    api.getLotes()
      .then((res) => {
        if (!cancelled && res?.success && Array.isArray(res.lotes)) {
          setLotesDisponibles(res.lotes);
        }
      })
      .catch((err) => console.error('No se pudieron cargar los lotes para reasignar expediente:', err));
    return () => { cancelled = true; };
  }, [expediente?.id]);

  if (!expediente) return null;

  const ine = expediente.ine || {};
  const dom = ine.domicilio || {};
  const currentChatUser = (() => {
    try {
      const saved = localStorage.getItem('credimovil_auth_user');
      return saved
        ? JSON.parse(saved)
        : { username: 'asesor', role: 'asesor', nombre: 'CrediMóvil' };
    } catch {
      return { username: 'asesor', role: 'asesor', nombre: 'CrediMóvil' };
    }
  })();
  const getLoteWhatsappNumber = () => {
    const raw = String(expediente.telefonoLote || '').replace(/\D/g, '');
    if (!raw) return '';
    if (raw.startsWith('52') && raw.length >= 12) return raw;
    return raw.length === 10 ? `52${raw}` : raw;
  };

  const openWhatsAppToLote = () => {
    const phone = getLoteWhatsappNumber();
    if (!phone) {
      alert('Este lote no tiene un celular registrado. Abre el Directorio de Lotes y captura su teléfono.');
      return;
    }

    const text = `*CrediMóvil - Actualización de expediente*\n` +
      `Folio: *${expediente.folio}*\n` +
      `Cliente: *${expediente.ine?.nombreCompleto || expediente.ine?.nombre}*\n` +
      `Estatus: *${estatus}*\n` +
      `Monto a financiar: *$${calcMontoFinanciar.toLocaleString('es-MX')} MXN*\n` +
      `Checklist: ${window.location.origin}/?tab=fondeo&folio=${expediente.folio}&pin=${expediente.pinFondeo}`;

    window.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const openEmailToLote = () => {
    const email = String(expediente.correoLote || '').trim();
    if (!email) {
      alert('Este lote no tiene correo registrado. Abre el Directorio de Lotes y captura su correo.');
      return;
    }

    const subject = `Actualización CrediMóvil - ${expediente.folio}`;
    const body =
      `Folio: ${expediente.folio}\n` +
      `Cliente: ${expediente.ine?.nombreCompleto || expediente.ine?.nombre || ''}\n` +
      `Estatus: ${estatus}\n` +
      `Monto a financiar: $${calcMontoFinanciar.toLocaleString('es-MX')} MXN\n` +
      `Checklist de documentación: ${window.location.origin}/?tab=fondeo&folio=${expediente.folio}&pin=${expediente.pinFondeo}`;

    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-4 backdrop-blur-md overflow-y-auto"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-8 max-h-[92vh]">
        {/* Top Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-slate-950 border-b border-slate-800 gap-3">
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

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowQuote(true)}
              className="py-1.5 px-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-red-900/25"
              title="Cotizar crédito"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Cotizar</span>
            </button>
            <button
              type="button"
              onClick={() => setShowObligadoModal(true)}
              className="py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5"
              title={expediente.obligadoSolidario?.requerido ? 'Editar obligado solidario' : 'Agregar obligado solidario'}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{expediente.obligadoSolidario?.requerido ? 'Editar obligado' : 'Agregar obligado'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                api.downloadExpedienteDocuments(expediente.id, expediente.folio).catch((err: any) => alert(err.message || 'No se pudieron descargar los documentos.'));
              }}
              className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700"
              title="Descargar todos los documentos del expediente"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Todos los documentos</span>
            </button>

            <button
              onClick={() => onOpenPrint(expediente)}
              className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition flex items-center gap-1.5 border border-slate-700"
              title="Generar carátula imprimible"
            >
              <Printer className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Carátula CrediMóvil</span>
            </button>

            <button
              onClick={openEmailToLote}
              className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700"
              title={expediente.correoLote ? `Enviar correo a ${expediente.correoLote}` : 'El lote no tiene correo registrado'}
            >
              <Mail className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Correo Lote</span>
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
        <div className="flex items-center gap-2 px-3 sm:px-6 py-2 bg-slate-900 border-b border-slate-800 overflow-x-auto">
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
            onClick={() => setShowComments(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 text-slate-400 hover:text-white bg-slate-950/50 border border-slate-800"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Comentarios
          </button>

          <button
            onClick={() => setActiveTab('estados')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'estados' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Estados de Cuenta OCR
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
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 sm:space-y-6">
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
                          setEngancheMonto(engancheMonto === '' ? calcEnganche : engancheMonto);
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
                          const value = Number(e.target.value);
                          setEngancheMonto(Number.isFinite(value) ? Math.min(Number(precio) || 0, Math.max(0, value)) : 0);
                        }}
                        className="w-full py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                      />
                    )}
                    <div className="text-[10px] text-slate-500 mt-1">
                      Efectivo: monto libre • Equivale a {calcEnganchePorcentajeReal}%
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
                  <div className="flex items-center justify-between gap-3">
                    <p>
                      <span className="text-slate-400">Lote:</span>{' '}
                      <strong className="text-white font-semibold">{expediente.loteNombre || 'Sin lote'}</strong>
                    </p>
                    <button
                      type="button"
                      onClick={() => setEditLote((value) => !value)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 text-[11px] font-bold"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {editLote ? 'Cancelar cambio' : 'Cambiar lote'}
                    </button>
                  </div>

                  {editLote && (
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-amber-500/20">
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nuevo lote</label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          value={nuevoLoteId}
                          onChange={(e) => setNuevoLoteId(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                        >
                          <option value="">Seleccionar lote...</option>
                          {lotesDisponibles.map((lote) => (
                            <option key={lote.id} value={lote.id}>{lote.nombre}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleSaveTerms}
                          disabled={isSaving || !nuevoLoteId || nuevoLoteId === expediente.loteId}
                          className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 text-xs font-black disabled:opacity-50"
                        >
                          {isSaving ? 'Guardando...' : 'Guardar lote'}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2">Al guardar, también se actualizarán los datos de contacto del lote en el expediente.</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <p>
                      <span className="text-slate-400">Vehículo:</span>{' '}
                      <strong className="text-red-400">
                        {expediente.autoMarca} {expediente.autoModelo} ({expediente.autoAno})
                      </strong>
                    </p>
                    <button
                      type="button"
                      onClick={() => setEditVehiculo((value) => !value)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-bold"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {editVehiculo ? 'Cancelar cambio' : 'Cambiar vehículo'}
                    </button>
                  </div>

                  {editVehiculo && (
                    <div className="mt-3 p-3 rounded-xl bg-slate-900/80 border border-amber-500/20 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Marca</label>
                          <input
                            type="text"
                            value={autoMarca}
                            onChange={(e) => setAutoMarca(e.target.value)}
                            placeholder="Ej. Kia"
                            className="w-full px-2.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Modelo</label>
                          <input
                            type="text"
                            value={autoModelo}
                            onChange={(e) => setAutoModelo(e.target.value)}
                            placeholder="Ej. Sorento"
                            className="w-full px-2.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Año</label>
                          <input
                            type="text"
                            value={autoAno}
                            onChange={(e) => setAutoAno(e.target.value)}
                            placeholder="2022"
                            maxLength={4}
                            className="w-full px-2.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Guarda los cambios con <strong className="text-slate-300">Guardar cambios</strong>. El precio, enganche y monto de financiamiento pueden actualizarse en la misma pantalla.
                      </p>
                    </div>
                  )}
                  {expediente.esVehiculoLegalizado && (
                    <p>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Vehículo Legalizado (Requiere Título & Pedimento)
                      </span>
                    </p>
                  )}
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Contacto del Lote</p>
                    <div className="flex flex-wrap gap-3 text-xs">
                      <a
                        href={expediente.telefonoLote ? `tel:${expediente.telefonoLote}` : '#'}
                        className="inline-flex items-center gap-1.5 text-white hover:text-red-300"
                        onClick={(e) => { if (!expediente.telefonoLote) e.preventDefault(); }}
                      >
                        <Phone className="w-3.5 h-3.5 text-red-400" /> {expediente.telefonoLote || 'Sin teléfono'}
                      </a>
                      {expediente.correoLote ? (
                        <a href={`mailto:${expediente.correoLote}`} className="inline-flex items-center gap-1.5 text-white hover:text-red-300">
                          <Mail className="w-3.5 h-3.5 text-red-400" /> {expediente.correoLote}
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-slate-500">
                          <Mail className="w-3.5 h-3.5" /> Sin correo
                        </span>
                      )}
                    </div>
                  </div>

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

              {expediente.obligadoSolidario?.requerido && (
                <div className="mt-5 p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h4 className="text-sm font-black text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-amber-400" />
                        Obligado Solidario
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {expediente.obligadoSolidario.nombre || 'Sin nombre capturado'} • documentación adjunta al mismo expediente
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-bold">
                      REQUERIDO
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      ['INE Frente', expediente.obligadoSolidario.fotoIneFrente],
                      ['INE Reverso', expediente.obligadoSolidario.fotoIneReverso],
                      ['Comprobante Domicilio', expediente.obligadoSolidario.comprobanteDomicilioUrl],
                      ['Estados Mes 1', expediente.obligadoSolidario.estadosCuenta?.mes1Url],
                      ['Estados Mes 2', expediente.obligadoSolidario.estadosCuenta?.mes2Url],
                      ['Estados Mes 3', expediente.obligadoSolidario.estadosCuenta?.mes3Url],
                      ['Estados 3 Meses Consolidado', expediente.obligadoSolidario.estadosCuenta?.archivoConsolidadoUrl],
                    ].filter(([, url]) => Boolean(url)).map(([label, url]) => (
                      <button
                        key={String(label)}
                        type="button"
                        onClick={() => {
                          setPreviewDocUrl(String(url));
                          setPreviewDocTitle(`Obligado Solidario - ${label}`);
                        }}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/40 text-left transition"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-bold text-slate-200">{label}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 block">Ver documento</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
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

          {activeTab === 'estados' && (
            <EstadosCuentaOCRPanel expediente={expediente} onUpdate={onUpdate} />
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
                    ['NOMINA_1', 'Nómina 1'],
                    ['NOMINA_2', 'Nómina 2'],
                    ['NOMINA_3', 'Nómina 3'],
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

              {/* 3. Comprobantes de Nómina */}
              <div className="pt-2 border-t border-slate-800">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">N</span>
                  Comprobantes de Nómina (Opcionales)
                </h4>

                {expediente.nominas?.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {expediente.nominas.map((nomina, index) => (
                      <div key={index} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">
                              {nomina.archivoNombre || `Nómina ${index + 1}`}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Comprobante de nómina {index + 1}
                            </p>
                          </div>
                        </div>
                        {nomina.archivoUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewDocUrl(nomina.archivoUrl || null);
                              setPreviewDocTitle(`Comprobante de Nómina ${index + 1}`);
                            }}
                            className="w-full mt-3 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-emerald-400" />
                            Ver comprobante
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No se adjuntaron comprobantes de nómina al crear el expediente.</p>
                )}
              </div>

              {/* 3. Documentos del Obligado Solidario */}
              {expediente.obligadoSolidario?.requerido && (
                <div className="pt-2 border-t border-slate-800">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[10px] flex items-center justify-center font-bold">O</span>
                    Documentos del Obligado Solidario
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      ['INE Frente', expediente.obligadoSolidario.fotoIneFrente],
                      ['INE Reverso', expediente.obligadoSolidario.fotoIneReverso],
                      ['Comprobante de domicilio', expediente.obligadoSolidario.comprobanteDomicilioUrl],
                      ['Estado de cuenta Mes 1', expediente.obligadoSolidario.estadosCuenta?.mes1Url],
                      ['Estado de cuenta Mes 2', expediente.obligadoSolidario.estadosCuenta?.mes2Url],
                      ['Estado de cuenta Mes 3', expediente.obligadoSolidario.estadosCuenta?.mes3Url],
                      ['Estados de cuenta consolidados', expediente.obligadoSolidario.estadosCuenta?.archivoConsolidadoUrl],
                      ...(expediente.obligadoSolidario.nominas || []).map((nomina, index) => [
                        `Nómina ${index + 1}`,
                        nomina.archivoUrl,
                      ]),
                    ]
                      .filter(([, url]) => Boolean(url))
                      .map(([label, url]) => (
                        <button
                          key={String(label)}
                          type="button"
                          onClick={() => {
                            setPreviewDocUrl(String(url));
                            setPreviewDocTitle(`Obligado Solidario - ${label}`);
                          }}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/40 text-left transition"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-amber-400" />
                            <span className="text-xs font-bold text-slate-200">{label}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 mt-1 block">Ver documento</span>
                        </button>
                      ))}
                  </div>

                  {![
                    expediente.obligadoSolidario.fotoIneFrente,
                    expediente.obligadoSolidario.fotoIneReverso,
                    expediente.obligadoSolidario.comprobanteDomicilioUrl,
                    expediente.obligadoSolidario.estadosCuenta?.mes1Url,
                    expediente.obligadoSolidario.estadosCuenta?.mes2Url,
                    expediente.obligadoSolidario.estadosCuenta?.mes3Url,
                    expediente.obligadoSolidario.estadosCuenta?.archivoConsolidadoUrl,
                    ...(expediente.obligadoSolidario.nominas || []).map((nomina) => nomina.archivoUrl),
                  ].some(Boolean) && (
                    <p className="text-xs text-slate-500 italic">
                      No se adjuntaron documentos del obligado solidario.
                    </p>
                  )}
                </div>
              )}

              {/* 4. Estados de Cuenta Bancarios (3 Meses) */}
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

              {/* OCR visible directly with the statement documents */}
              {(expediente.estadosCuenta?.archivoConsolidadoUrl || expediente.estadosCuenta?.mes1Url || expediente.estadosCuenta?.mes2Url || expediente.estadosCuenta?.mes3Url) && (
                <div className="pt-4 border-t border-slate-800">
                  <EstadosCuentaOCRPanel expediente={expediente} onUpdate={onUpdate} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AgregarObligadoModal
        expediente={expediente}
        isOpen={showObligadoModal}
        onClose={() => setShowObligadoModal(false)}
        onSaved={(updated) => {
          onUpdate(updated);
          setShowObligadoModal(false);
        }}
      />

      {showQuote && (
        <CotizadorCreditoModal
          expediente={expediente}
          onClose={() => setShowQuote(false)}
        />
      )}

      {showComments && (
        <ExpedienteComentariosModal
          isOpen={showComments}
          onClose={() => setShowComments(false)}
          expedienteId={expediente.folio}
          folio={expediente.folio}
          authUser={currentChatUser}
        />
      )}

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
          <div className="relative w-full max-w-4xl h-[92vh] sm:h-auto max-h-[92vh] bg-[#1C2541] rounded-2xl overflow-hidden p-3 sm:p-4 border border-[#2E3A59] flex flex-col">
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
                <>
                  <div className="hidden md:flex w-full h-[75vh] items-center justify-center">
                    <object
                      data={previewDocUrl}
                      type="application/pdf"
                      className="w-full h-full rounded bg-white"
                    >
                      <div className="text-center p-6 text-slate-300">
                        <p className="text-sm mb-3">Tu navegador no previsualiza el PDF directamente.</p>
                        <a href={previewDocUrl} target="_blank" rel="noopener noreferrer" className="py-2.5 px-4 bg-red-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2">
                          <ExternalLink className="w-4 h-4" /> Abrir PDF
                        </a>
                      </div>
                    </object>
                  </div>
                  <div className="md:hidden w-full rounded-2xl border border-[#2E3A59] bg-[#121824] p-6 text-center">
                    <FileText className="w-12 h-12 text-red-400 mx-auto mb-3" />
                    <h5 className="text-base font-black text-white">PDF listo para visualizar</h5>
                    <p className="text-xs text-slate-400 mt-2 mb-5">
                      En celular, Chrome puede no mostrar PDFs dentro de esta ventana. Ábrelo directamente para verlo completo.
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      <a href={previewDocUrl} target="_blank" rel="noopener noreferrer" className="py-3 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2">
                        <ExternalLink className="w-4 h-4" /> Abrir PDF en el celular
                      </a>
                      <a href={previewDocUrl} download={previewDocTitle || 'documento.pdf'} className="py-3 px-4 bg-[#1C2541] hover:bg-[#2E3A59] border border-[#2E3A59] text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2">
                        <Download className="w-4 h-4" /> Descargar PDF
                      </a>
                    </div>
                  </div>
                </>
              ) : (
                <img
                  src={previewDocUrl}
                  alt="Documento"
                  className="max-h-[75vh] max-w-full object-contain rounded"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};