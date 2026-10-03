import React, { useState, useEffect, useRef } from 'react';
import {
  FolderSync,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Upload,
  Camera,
  FileText,
  DollarSign,
  Car,
  Building2,
  ShieldCheck,
  Check,
  XCircle,
  Eye,
  Share2,
  RefreshCw,
  Send,
  HelpCircle,
  Lock,
  ExternalLink,
  Download,
} from 'lucide-react';
import { CameraCaptureModal } from './CameraCaptureModal';
import { api } from '../services/api';
import { ExpedienteCredito, DocumentoFondeo } from '../types';

interface LoteFondeoPortalProps {
  initialFolio?: string;
  initialPin?: string;
}

export const LoteFondeoPortal: React.FC<LoteFondeoPortalProps> = ({
  initialFolio,
  initialPin,
}) => {
  const [folioInput, setFolioInput] = useState(initialFolio || '');
  const [pinInput, setPinInput] = useState(initialPin || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expediente, setExpediente] = useState<ExpedienteCredito | null>(null);

  // Upload modal state
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [previewDocTitle, setPreviewDocTitle] = useState<string>('');
  const [previewDocType, setPreviewDocType] = useState<string>('image');

  // Native camera input ref
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeUploadTargetDocId, setActiveUploadTargetDocId] = useState<string | null>(null);

  // CLABE state
  const [cuentaClabe, setCuentaClabe] = useState('');
  const [bancoLote, setBancoLote] = useState('');
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [bankSuccessMsg, setBankSuccessMsg] = useState(false);

  useEffect(() => {
    if (initialFolio) {
      setFolioInput(initialFolio);
      if (initialPin) {
        setPinInput(initialPin);
        handleLookup(initialFolio, initialPin);
      }
    }
  }, [initialFolio, initialPin]);

  const handleLookup = async (folioToSearch?: string, pinToSearch?: string) => {
    const f = (folioToSearch || folioInput).trim().toUpperCase();
    const p = (pinToSearch !== undefined ? pinToSearch : pinInput).trim();

    if (!f) {
      setError('Por favor ingresa el folio CrediMóvil del expediente (ej. EXP-2026-1001).');
      return;
    }

    if (!/^\d{4}$/.test(p)) {
      setError('Ingresa el PIN de 4 dígitos que te proporcionó CrediMóvil.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await api.lookupByFolio(f, p || undefined);
      if (res.success && res.expediente) {
        setExpediente(res.expediente);
        setCuentaClabe(res.expediente.cuentaClabeLote || '');
        setBancoLote(res.expediente.bancoLote || '');
      } else {
        setError(res.message || 'No se encontró el expediente.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al buscar el expediente.');
      setExpediente(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Upload file (PNG, JPG, PDF)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docId: string) => {
    const file = e.target.files?.[0];
    if (!file || !expediente) return;

    const fileSizeStr = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    const fileName = file.name;

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        await submitDocUpload(docId, reader.result, fileName, fileSizeStr);
      }
    };
    reader.readAsDataURL(file);
  };

  const submitDocUpload = async (docId: string, archivoUrl: string, archivoNombre: string, archivoTamano?: string) => {
    if (!expediente) return;
    setIsLoading(true);
    try {
      const res = await api.uploadFondeoDoc(expediente.id, {
        docId,
        archivoUrl,
        archivoNombre,
        archivoTamano,
        subidoPor: expediente.loteNombre || 'Lote de Autos',
      });
      if (res.success) {
        setExpediente({
          ...expediente,
          documentosFondeo: res.documentosFondeo,
          estatus: res.expedienteEstatus as any,
        });
      }
    } catch (err: any) {
      alert(err.message || 'Error al subir documento');
    } finally {
      setIsLoading(false);
      setUploadingDocId(null);
      setActiveUploadTargetDocId(null);
    }
  };

  const handleSaveBankInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expediente) return;
    setIsSavingBank(true);
    try {
      const res = await api.updateExpediente(expediente.id, {
        cuentaClabeLote: cuentaClabe,
        bancoLote: bancoLote,
      });
      if (res.success) {
        setBankSuccessMsg(true);
        setTimeout(() => setBankSuccessMsg(false), 3000);
      }
    } catch {
      alert('Error al guardar datos bancarios del lote.');
    } finally {
      setIsSavingBank(false);
    }
  };

  // Trigger preview
  const openPreview = (doc: DocumentoFondeo) => {
    if (!doc.archivoUrl) return;
    setPreviewDocUrl(doc.archivoUrl);
    setPreviewDocTitle(doc.nombre);
    setPreviewDocType(doc.archivoTipo === 'pdf' || /\.pdf(?:$|[?#])/i.test(doc.archivoUrl) ? 'pdf' : 'image');
  };

  // Progress
  const docs = expediente?.documentosFondeo || [];
  const requiredDocs = docs.filter((d) => d.requerido);
  const uploadedRequired = requiredDocs.filter((d) => d.estatus === 'SUBIDO' || d.estatus === 'APROBADO');
  const approvedRequired = requiredDocs.filter((d) => d.estatus === 'APROBADO');
  const progressPercent = requiredDocs.length > 0 ? Math.round((uploadedRequired.length / requiredDocs.length) * 100) : 0;
  const approvedPercent = requiredDocs.length > 0 ? Math.round((approvedRequired.length / requiredDocs.length) * 100) : 0;

  const notifyAdvisorWhatsApp = () => {
    if (!expediente) return;
    const text = `*Notificación CrediMóvil - Papelería para Fondeo*\n` +
      `Folio: *${expediente.folio}*\n` +
      `Lote: *${expediente.loteNombre}*\n` +
      `Cliente: *${expediente.ine?.nombreCompleto || expediente.ine?.nombre}*\n` +
      `Vehículo: *${expediente.autoMarca} ${expediente.autoModelo} (${expediente.autoAno})*\n` +
      `Avance Checklist: *${uploadedRequired.length} de ${requiredDocs.length} documentos subidos (${progressPercent}%)*.\n` +
      `Favor de revisar para proceder con la orden de pago y dispersión de fondeo.`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#0B132B] px-3 sm:px-6 py-8 sm:py-10">
      {/* Header */}
      <div className="max-w-5xl mx-auto text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-bold mb-3">
          <FolderSync className="w-3.5 h-3.5" />
          <span>CrediMóvil • Checklist de Documentación para Trámite de Vehículo</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-100 tracking-tight">
          Carga de Documentos para <span className="text-red-500">Fondeo de Vehículo</span>
        </h1>
        <p className="text-sm sm:text-base text-[#294767] max-w-2xl mx-auto mt-2">
          Cuando el crédito de tu cliente es aprobado, el lote sube directamente los documentos (PNG o PDF) para que se libere el pago de fondeo a tu cuenta sin intermediarios.
        </p>
      </div>

      {/* Lookup Card */}
      <div className="max-w-6xl mx-auto bg-[#071A33] border border-[#0F2A4D] rounded-3xl p-5 sm:p-6 shadow-[0_18px_45px_rgba(7,26,51,0.22)] mb-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLookup();
          }}
          className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end"
        >
          <div className="sm:col-span-6">
            <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-1.5">
              Folio CrediMóvil
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-[#8AA0B8] absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={folioInput}
                onChange={(e) => setFolioInput(e.target.value.toUpperCase())}
                placeholder="ej. EXP-2026-1001"
                className="w-full py-2.5 pl-10 pr-4 bg-[#F5F8FC] border border-[#C5D1DF] rounded-xl text-[#102A43] font-mono text-sm uppercase focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              PIN del Lote (4 Dígitos)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-300 absolute left-3.5 top-3.5" />
              <input
                type="password"
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="••••"
                className="w-full py-2.5 pl-10 pr-4 bg-[#F5F8FC] border border-[#C5D1DF] rounded-xl text-[#102A43] font-mono text-sm focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={isLoading || !folioInput.trim() || !/^\d{4}$/.test(pinInput.trim())}
              className="w-full py-2.5 px-4 bg-[#E3262F] hover:bg-[#C81E2B] disabled:opacity-50 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-red-900/25 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Consultar Fondeo
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-950/30 border border-red-500/30 rounded-xl text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Expediente Overview & Funding Checklist */}
      {expediente && (
        <div className="space-y-8 animate-fadeIn">
          {/* Status Banner */}
          <div className="bg-[#071A33] border border-red-500/30 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-xl sm:text-2xl font-mono font-black text-red-400">
                    {expediente.folio}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      expediente.estatus === 'FONDEADO'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : expediente.estatus === 'APROBADO' || expediente.estatus === 'FONDEO_REVISION'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}
                  >
                    {expediente.estatus === 'APROBADO' && '¡Crédito Aprobado! Listo para Fondeo'}
                    {expediente.estatus === 'FONDEO_REVISION' && 'Papelería en Revisión por Asesor'}
                    {expediente.estatus === 'FONDEADO' && '¡Crédito Fondeado y Liquidado al Lote!'}
                    {expediente.estatus === 'EN_EVALUACION' && 'En Análisis de Crédito'}
                    {expediente.estatus === 'NUEVO' && 'Solicitud Registrada'}
                    {expediente.estatus === 'RECHAZADO' && 'Crédito No Aprobado'}
                  </span>
                </div>

                <h2 className="text-lg sm:text-xl font-bold text-white">
                  Cliente: {expediente.ine?.nombreCompleto || expediente.ine?.nombre}
                </h2>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                  <span>Lote: <strong className="text-white">{expediente.loteNombre}</strong></span>
                  <span>•</span>
                  <span>Financiera: <strong className="text-red-400">{expediente.financieraAsignada || 'CrediMóvil Auto'}</strong></span>
                </p>
              </div>

              {/* Financial Highlight */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:px-6 flex items-center gap-6">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Monto Fondeo al Lote
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                    ${(expediente.montoFinanciar || 0).toLocaleString('es-MX')}
                  </span>
                  <span className="text-[10px] text-slate-400 block">Transferencia bancaria SPEI</span>
                </div>

                <div className="border-l border-slate-800 pl-6 hidden sm:block">
                  <span className="text-[11px] text-slate-400 block">Vehículo:</span>
                  <span className="text-sm font-semibold text-white block">
                    {expediente.autoMarca} {expediente.autoModelo} ({expediente.autoAno})
                  </span>
                  {expediente.esVehiculoLegalizado && (
                    <span className="text-[10px] text-amber-400 font-bold uppercase block">
                      Vehículo Legalizado
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-6 pt-6 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-slate-300">
                  Progreso del Checklist ({uploadedRequired.length} de {requiredDocs.length} documentos subidos)
                </span>
                <span className="font-bold text-red-400">{progressPercent}% completado</span>
              </div>
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-emerald-400 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Bank Account Section for Funding Payment */}
          <div className="bg-[#071A33] border border-[#0F2A4D] rounded-3xl p-6 shadow-[0_14px_32px_rgba(7,26,51,0.15)]">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-red-500" />
                <h3 className="text-base font-bold text-white">
                  Cuenta Bancaria del Lote para Dispersión de Fondeo
                </h3>
              </div>
              {bankSuccessMsg && (
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Cuenta guardada exitosamente
                </span>
              )}
            </div>

            <form onSubmit={handleSaveBankInfo} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  CLABE Interbancaria (18 dígitos)
                </label>
                <input
                  type="text"
                  maxLength={18}
                  value={cuentaClabe}
                  onChange={(e) => setCuentaClabe(e.target.value)}
                  placeholder="012580001234567890"
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Banco Receptor
                </label>
                <input
                  type="text"
                  value={bancoLote}
                  onChange={(e) => setBancoLote(e.target.value)}
                  placeholder="ej. BBVA, Banorte, Santander"
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={isSavingBank}
                  className="w-full py-2 px-4 bg-[#0F2A4D] hover:bg-[#163A64] text-white border border-[#294767] font-semibold rounded-xl text-xs transition flex items-center justify-center gap-2"
                >
                  {isSavingBank ? 'Guardando...' : 'Actualizar Cuenta'}
                </button>
              </div>
            </form>
          </div>

          {/* Checklist de Documentación CrediMóvil (Image 1 & 2) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-red-500" />
                  Checklist CrediMóvil de Documentación Oficial
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Sube los documentos en formato PNG o PDF. La documentación debe presentarse en buen estado, legible y completa.
                </p>
              </div>

              <button
                type="button"
                onClick={notifyAdvisorWhatsApp}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                Notificar Avance por WhatsApp
              </button>
            </div>

            {/* Document list */}
            <div className="space-y-4">
              {docs.map((doc, index) => {
                const isApproved = doc.estatus === 'APROBADO';
                const isRejected = doc.estatus === 'RECHAZADO';
                const isUploaded = doc.estatus === 'SUBIDO';
                const isPending = doc.estatus === 'PENDIENTE';

                return (
                  <div
                    key={doc.id}
                    className={`p-4 sm:p-5 rounded-2xl border transition ${
                      isApproved
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : isRejected
                        ? 'bg-rose-950/20 border-rose-500/30'
                        : isUploaded
                        ? 'bg-amber-950/20 border-amber-500/30'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Left: Info */}
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold flex items-center justify-center">
                            {index + 1}
                          </span>
                          <h4 className="text-sm font-bold text-white">
                            {doc.nombre}
                          </h4>
                          {doc.categoria === 'VEHICULO_LEGALIZADO' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              Vehículo Legalizado
                            </span>
                          )}
                          {doc.requerido ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              Obligatorio
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                              Opcional
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-400 pl-7">
                          {doc.descripcion}
                        </p>

                        <div className="pl-7 pt-1 flex flex-wrap items-center gap-3 text-xs">
                          {isApproved && (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Aprobado por Asesor CrediMóvil
                            </span>
                          )}
                          {isRejected && (
                            <span className="text-rose-400 font-semibold flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" />
                              Observación / Requiere Corrección
                            </span>
                          )}
                          {isUploaded && (
                            <span className="text-amber-400 font-medium flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              Subido — En revisión de mesa
                            </span>
                          )}
                          {isPending && (
                            <span className="text-slate-400 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Pendiente de carga
                            </span>
                          )}

                          {doc.archivoNombre && (
                            <span className="text-slate-300 font-medium">
                              • {doc.archivoNombre} ({doc.archivoTamano || 'Cargado'})
                            </span>
                          )}
                        </div>

                        {doc.observaciones && (
                          <div className="ml-7 mt-2 p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/40 text-xs text-rose-300">
                            <strong>Observación CrediMóvil:</strong> {doc.observaciones}
                          </div>
                        )}
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 pl-7 sm:pl-0 shrink-0">
                        {doc.archivoUrl && (
                          <button
                            type="button"
                            onClick={() => openPreview(doc)}
                            className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700"
                          >
                            <Eye className="w-3.5 h-3.5 text-red-400" />
                            Ver Archivo
                          </button>
                        )}

                        {/* Upload trigger */}
                        <div className="flex items-center gap-1">
                          <label className="py-1.5 px-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-red-900/25">
                            <Upload className="w-3.5 h-3.5" />
                            <span>{doc.archivoUrl ? 'Reemplazar' : 'Subir PNG / PDF'}</span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,application/pdf"
                              className="hidden"
                              onChange={(e) => handleFileUpload(e, doc.id)}
                            />
                          </label>

                          {/* Native camera trigger */}
                          <label
                            className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition cursor-pointer"
                            title="Tomar foto con la cámara del celular"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => handleFileUpload(e, doc.id)}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal (PNG & PDF) */}
      {previewDocUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md">
          <div className="relative w-full max-w-4xl h-[92vh] sm:h-auto bg-[#1C2541] rounded-3xl border border-[#2E3A59] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-red-500" />
                <h4 className="text-sm font-bold text-white">{previewDocTitle}</h4>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={previewDocUrl}
                  download={previewDocTitle}
                  className="py-1 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar
                </a>
                <button
                  onClick={() => setPreviewDocUrl(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-auto flex items-center justify-center bg-slate-950 min-h-[50vh]">
              {previewDocType === 'pdf' ? (
                <>
                  <div className="hidden md:flex w-full h-[70vh] items-center justify-center">
                    <object
                      data={previewDocUrl}
                      type="application/pdf"
                      className="w-full h-full rounded-xl border border-slate-800 bg-white"
                    >
                      <div className="text-center p-6 text-slate-300">
                        <p className="text-sm mb-3">Tu navegador no previsualiza el PDF directamente.</p>
                        <a
                          href={previewDocUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Abrir PDF
                        </a>
                      </div>
                    </object>
                  </div>

                  <div className="md:hidden w-full rounded-2xl border border-[#2E3A59] bg-[#121824] p-6 text-center">
                    <FileText className="w-12 h-12 text-red-400 mx-auto mb-3" />
                    <h5 className="text-base font-black text-white">PDF listo para visualizar</h5>
                    <p className="text-xs text-slate-400 mt-2 mb-5">
                      En celular, el visor integrado de Chrome puede no mostrar PDFs dentro de la ventana. Ábrelo directamente para verlo completo.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <a
                        href={previewDocUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-3 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Abrir PDF en el celular
                      </a>
                      <a
                        href={previewDocUrl}
                        download={previewDocTitle || 'documento.pdf'}
                        className="py-3 px-4 bg-[#1C2541] hover:bg-[#2E3A59] border border-[#2E3A59] text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Descargar PDF
                      </a>
                    </div>
                  </div>
                </>
              ) : (
                <img
                  src={previewDocUrl}
                  alt={previewDocTitle}
                  className="max-h-[72vh] max-w-full object-contain rounded-xl shadow-xl"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
