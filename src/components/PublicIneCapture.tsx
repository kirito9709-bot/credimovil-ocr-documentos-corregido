import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Upload,
  Scan,
  CheckCircle2,
  AlertCircle,
  Car,
  User,
  MapPin,
  Calendar,
  Sparkles,
  RefreshCw,
  Building2,
  DollarSign,
  Phone,
  Mail,
  Share2,
  Copy,
  Check,
  ArrowRight,
  Shield,
  FileCheck,
  Users,
  Briefcase,
  Home,
  FileText,
  Zap,
  CheckCheck,
  Eye,
  Trash2,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react';
import { CameraCaptureModal } from './CameraCaptureModal';
import { api } from '../services/api';
import { IneData, LoteAuto, ExpedienteCredito, ReferenciaPersonal, EstadosCuentaAnalisis } from '../types';
import { calcularRfcBase } from '../utils/rfc';

interface PublicIneCaptureProps {
  lotes: LoteAuto[];
  onExpedienteCreated: (expediente: ExpedienteCredito) => void;
  onGoToFondeo: (folio: string) => void;
}

export const PublicIneCapture: React.FC<PublicIneCaptureProps> = ({
  lotes,
  onExpedienteCreated,
  onGoToFondeo,
}) => {
  // 1. Identificación Oficial INE
  const [fotoFrente, setFotoFrente] = useState<string | null>(null);
  const [fotoFrenteNombre, setFotoFrenteNombre] = useState<string>('');
  const [fotoReverso, setFotoReverso] = useState<string | null>(null);
  const [fotoReversoNombre, setFotoReversoNombre] = useState<string>('');

  // Hidden native camera inputs (capture="environment")
  const frenteCameraInputRef = useRef<HTMLInputElement | null>(null);
  const reversoCameraInputRef = useRef<HTMLInputElement | null>(null);
  const frenteFileInputRef = useRef<HTMLInputElement | null>(null);
  const reversoFileInputRef = useRef<HTMLInputElement | null>(null);

  // Modal camera state (fallback)
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSide, setCameraSide] = useState<'frente' | 'reverso'>('frente');

  // OCR state
  const [isScanning, setIsScanning] = useState(false);
  const [ocrCompleted, setOcrCompleted] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Form Fields - INE
  const [ineData, setIneData] = useState<IneData>({
    nombre: '',
    primerApellido: '',
    segundoApellido: '',
    nombreCompleto: '',
    curp: '',
    rfc: '',
    claveElector: '',
    fechaNacimiento: '',
    sexo: '',
    edad: undefined,
    domicilio: {
      calle: '',
      numExterior: '',
      numInterior: '',
      colonia: '',
      codigoPostal: '',
      municipio: '',
      estado: '',
      domicilioCompleto: '',
    },
    vigencia: {
      emision: '',
      vigenciaHasta: '',
      seccion: '',
    },
    ocrCic: '',
    tipoCredencial: '',
    calidadImagen: 'BUENA',
    observaciones: [],
  });

  // 2. Comprobante de Domicilio (Agua o Luz CFE)
  const [domicilioCoincideConIne, setDomicilioCoincideConIne] = useState<boolean>(true);
  const [comprobanteDomicilioDoc, setComprobanteDomicilioDoc] = useState<string | null>(null);
  const [comprobanteDomicilioNombre, setComprobanteDomicilioNombre] = useState<string>('');
  const [tipoComprobante, setTipoComprobante] = useState<'CFE_LUZ' | 'AGUA' | 'OTRO'>('CFE_LUZ');
  const [isScanningComprobante, setIsScanningComprobante] = useState(false);
  const [comprobanteScanSuccess, setComprobanteScanSuccess] = useState<string | null>(null);
  const [comprobanteScanError, setComprobanteScanError] = useState<string | null>(null);
  const comprobanteCameraInputRef = useRef<HTMLInputElement | null>(null);
  const comprobanteFileInputRef = useRef<HTMLInputElement | null>(null);

  // 3. Estados de Cuenta de los últimos 3 meses (Obligatorio para Análisis)
  const [modoEstadosCuenta, setModoEstadosCuenta] = useState<'individual' | 'consolidado'>('individual');
  const [bancoEmisor, setBancoEmisor] = useState<string>('');
  const [mes1Doc, setMes1Doc] = useState<string | null>(null);
  const [mes1Nombre, setMes1Nombre] = useState<string>('');
  const [mes2Doc, setMes2Doc] = useState<string | null>(null);
  const [mes2Nombre, setMes2Nombre] = useState<string>('');
  const [mes3Doc, setMes3Doc] = useState<string | null>(null);
  const [mes3Nombre, setMes3Nombre] = useState<string>('');
  const [consolidadoDoc, setConsolidadoDoc] = useState<string | null>(null);
  const [consolidadoNombre, setConsolidadoNombre] = useState<string>('');

  const mes1InputRef = useRef<HTMLInputElement | null>(null);
  const mes2InputRef = useRef<HTMLInputElement | null>(null);
  const mes3InputRef = useRef<HTMLInputElement | null>(null);
  const consolidadoInputRef = useRef<HTMLInputElement | null>(null);

  // Preview Modal for any uploaded document
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);
  const [previewModalTitle, setPreviewModalTitle] = useState<string>('');

  // 4. Checklist Inicio de Crédito Automotriz (CrediMóvil)
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [ingresoMensual, setIngresoMensual] = useState<number | ''>('');
  const [tiempoViviendoDomicilio, setTiempoViviendoDomicilio] = useState('');
  const [casaPropiaORentada, setCasaPropiaORentada] = useState<'PROPIA' | 'RENTADA' | 'FAMILIAR' | ''>('');
  const [tiempoEnTrabajo, setTiempoEnTrabajo] = useState('');
  const [nombreUbicacionEmpleo, setNombreUbicacionEmpleo] = useState('');
  const [direccionEmpleo, setDireccionEmpleo] = useState('');
  const [giroActividadEmpresa, setGiroActividadEmpresa] = useState('');
  const [dependientesEconomicos, setDependientesEconomicos] = useState<number>(0);
  const [estadoCivil, setEstadoCivil] = useState<'SOLTERO' | 'CASADO' | 'UNION_LIBRE' | 'DIVORCIADO' | 'VIUDO' | ''>('SOLTERO');

  // Referencias Personales
  const [referencias, setReferencias] = useState<ReferenciaPersonal[]>([
    { nombre: '', telefono: '', relacion: 'Familiar (otro domicilio)', esFamiliar: true },
    { nombre: '', telefono: '', relacion: 'Conocido 1', esFamiliar: false },
    { nombre: '', telefono: '', relacion: 'Conocido 2', esFamiliar: false },
  ]);

  // Dealership
  const [selectedLoteId, setSelectedLoteId] = useState<string>('');
  const [customLoteNombre, setCustomLoteNombre] = useState<string>('');
  const [contactoVendedorLote, setContactoVendedorLote] = useState<string>('');

  // Vehicle
  const [autoMarca, setAutoMarca] = useState('');
  const [autoModelo, setAutoModelo] = useState('');
  const [autoAno, setAutoAno] = useState<number>(new Date().getFullYear());
  const [autoPrecio, setAutoPrecio] = useState<number | ''>('');
  const [engancheModo, setEngancheModo] = useState<'PORCENTAJE' | 'MONTO'>('PORCENTAJE');
  const [enganchePorcentaje, setEnganchePorcentaje] = useState<number>(20);
  const [engancheMonto, setEngancheMonto] = useState<number | ''>('');
  const [plazoMeses, setPlazoMeses] = useState<number>(48);
  const [esVehiculoLegalizado, setEsVehiculoLegalizado] = useState(false);

  // Saving
  const [isSaving, setIsSaving] = useState(false);
  const [savedExpediente, setSavedExpediente] = useState<ExpedienteCredito | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (lotes.length > 0 && !selectedLoteId) {
      setSelectedLoteId(lotes[0].id);
    }
  }, [lotes]);

  useEffect(() => {
    const curp = (ineData.curp || '').trim().toUpperCase();
    if (curp.length < 10) return;
    const base = curp.substring(0, 10);
    setIneData((prev) => {
      const current = (prev.rfc || '').trim().toUpperCase();
      if (
        (current.length === 10 && current === base) ||
        (current.length === 13 && current.substring(0, 10) === base)
      ) {
        return prev;
      }
      return { ...prev, rfc: base };
    });
  }, [ineData.curp]);

  // Handle Photo Capture from modal
  const handleCapture = (base64: string) => {
    if (cameraSide === 'frente') {
      setFotoFrente(base64);
      setFotoFrenteNombre('Foto_INE_Frente.jpg');
    } else {
      setFotoReverso(base64);
      setFotoReversoNombre('Foto_INE_Reverso.jpg');
    }
    setScanError(null);
  };

  // Handle Native File / Camera Input for INE
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>, side: 'frente' | 'reverso') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (side === 'frente') {
          setFotoFrente(reader.result);
          setFotoFrenteNombre(fileName);
        } else {
          setFotoReverso(reader.result);
          setFotoReversoNombre(fileName);
        }
        setScanError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  // Run CrediMóvil OCR
  const handleRunOcr = async () => {
    if (!fotoFrente) {
      setScanError('Por favor captura o sube al menos el frente de la credencial INE (en PNG, JPG o PDF).');
      return;
    }

    setIsScanning(true);
    setScanError(null);

    try {
      const res = await api.scanIne(fotoFrente, fotoReverso || undefined);
      if (res.success && res.data) {
        let finalRfc = res.data.rfc || '';
        if (!finalRfc || finalRfc.length < 10) {
          finalRfc = calcularRfcBase(
            res.data.curp,
            res.data.nombre,
            res.data.primerApellido,
            res.data.segundoApellido,
            res.data.fechaNacimiento
          );
        }

        setIneData((prev) => ({
          ...prev,
          ...res.data,
          rfc: finalRfc,
          domicilio: {
            ...prev.domicilio,
            ...(res.data.domicilio || {}),
          },
          vigencia: {
            ...prev.vigencia,
            ...(res.data.vigencia || {}),
          },
        }));
        setOcrCompleted(true);
      } else {
        throw new Error(res.message || 'No se pudieron extraer los datos.');
      }
    } catch (err: any) {
      console.error(err);
      setScanError(err.message || 'Error al ejecutar CrediMóvil OCR. Revisa la nitidez de la foto o escribe los datos en los campos.');
    } finally {
      setIsScanning(false);
    }
  };

  // Comprobante de Domicilio File Handlers
  const handleComprobanteFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setComprobanteDomicilioNombre(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setComprobanteDomicilioDoc(reader.result);
        setComprobanteScanError(null);
        setComprobanteScanSuccess(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRunComprobanteOcr = async () => {
    if (!comprobanteDomicilioDoc) {
      setComprobanteScanError('Por favor sube o toma foto de tu recibo de agua o luz CFE primero.');
      return;
    }

    setIsScanningComprobante(true);
    setComprobanteScanError(null);
    setComprobanteScanSuccess(null);

    try {
      const res = await api.scanComprobanteDomicilio(comprobanteDomicilioDoc);
      if (res.success && res.data) {
        setIneData((prev) => ({
          ...prev,
          domicilio: {
            ...prev.domicilio,
            calle: res.data.calle || prev.domicilio.calle,
            numExterior: res.data.numExterior || prev.domicilio.numExterior,
            numInterior: res.data.numInterior || prev.domicilio.numInterior,
            colonia: res.data.colonia || prev.domicilio.colonia,
            codigoPostal: res.data.codigoPostal || prev.domicilio.codigoPostal,
            municipio: res.data.municipio || prev.domicilio.municipio,
            estado: res.data.estado || prev.domicilio.estado,
            domicilioCompleto: res.data.domicilioCompleto || prev.domicilio.domicilioCompleto,
          },
        }));

        if (res.data.tipoComprobante === 'AGUA') {
          setTipoComprobante('AGUA');
        } else if (res.data.tipoComprobante === 'CFE_LUZ') {
          setTipoComprobante('CFE_LUZ');
        }

        const emisor = res.data.companiaEmisora || (res.data.tipoComprobante === 'AGUA' ? 'Recibo de Agua' : 'Recibo de Luz CFE');
        setComprobanteScanSuccess(`¡Domicilio extraído de ${emisor}! Los campos de abajo fueron completados automáticamente.`);
      } else {
        throw new Error(res.message || 'No se pudieron extraer los datos del comprobante.');
      }
    } catch (err: any) {
      console.error(err);
      setComprobanteScanError(err.message || 'Error al procesar el comprobante con OCR. Puedes capturar la dirección manualmente.');
    } finally {
      setIsScanningComprobante(false);
    }
  };

  // Estados de cuenta file handlers
  const handleBankDocInput = (e: React.ChangeEvent<HTMLInputElement>, target: 'mes1' | 'mes2' | 'mes3' | 'consolidado') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (target === 'mes1') {
          setMes1Doc(reader.result);
          setMes1Nombre(file.name);
        } else if (target === 'mes2') {
          setMes2Doc(reader.result);
          setMes2Nombre(file.name);
        } else if (target === 'mes3') {
          setMes3Doc(reader.result);
          setMes3Nombre(file.name);
        } else if (target === 'consolidado') {
          setConsolidadoDoc(reader.result);
          setConsolidadoNombre(file.name);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Readiness evaluation for analysis
  const hasIneCompleta = Boolean(fotoFrente && fotoReverso);
  const hasComprobanteDomicilio = Boolean(comprobanteDomicilioDoc);
  const hasDomicilioCompleto = !domicilioCoincideConIne
    ? Boolean(comprobanteDomicilioDoc)
    : Boolean(ineData.domicilio?.calle || ocrCompleted || fotoFrente);
  const hasEstadosCuenta = modoEstadosCuenta === 'consolidado' ? Boolean(consolidadoDoc) : Boolean(mes1Doc && mes2Doc && mes3Doc);

  let docsCompletadosCount = 0;
  if (hasIneCompleta) docsCompletadosCount++;
  if (hasDomicilioCompleto) docsCompletadosCount++;
  if (hasEstadosCuenta) docsCompletadosCount++;

  // Calculations: enganche expressed as a percentage, minimum 20%.
  const precioSeguro = Number(autoPrecio) || 0;
  const engancheMinimoPesos = Math.round(precioSeguro * 0.20);
  const enganchePorcentajeSeguro = Math.min(100, Math.max(20, Number(enganchePorcentaje) || 20));
  const engancheMontoSeguro = Math.min(
    precioSeguro,
    Math.max(0, Number(engancheMonto) || 0)
  );
  const calcEnganche = engancheModo === 'PORCENTAJE'
    ? Math.round(precioSeguro * enganchePorcentajeSeguro / 100)
    : engancheMontoSeguro;
  const calcEnganchePorcentajeReal = precioSeguro > 0 ? Math.round((calcEnganche / precioSeguro) * 10000) / 100 : 0;
  const calcMontoFinanciar = Math.max(0, (Number(autoPrecio) || 0) - calcEnganche);
  // Mensualidad según las cotizaciones proporcionadas:
  // capital mensual + 2.00% interés + 16% IVA sobre interés + GPS $260 + SDD $142.
  const capitalMensual = calcMontoFinanciar > 0 && plazoMeses > 0
    ? Math.round((calcMontoFinanciar / plazoMeses) * 100) / 100
    : 0;
  const interesMensual = Math.round(calcMontoFinanciar * 0.02 * 100) / 100;
  const ivaInteres = Math.round(interesMensual * 0.16 * 100) / 100;
  const mensualidadEstimada = calcMontoFinanciar > 0
    ? Math.round((capitalMensual + interesMensual + ivaInteres + 260 + 142) * 100) / 100
    : 0;

  // Save to database
  const handleSaveExpediente = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ineData.nombreCompleto && (!ineData.nombre || !ineData.primerApellido)) {
      setScanError('Debe ingresar al menos el nombre y apellido del cliente.');
      return;
    }

    const referenciasIncompletas = referencias.some(
      (r) => !r.nombre.trim() || !r.telefono.trim()
    );
    if (referencias.length !== 3 || referenciasIncompletas) {
      setScanError('Debes capturar las 3 referencias obligatorias: 1 familiar de otro domicilio y 2 conocidos.');
      return;
    }

    const telefonosReferencias = referencias.map((r) => r.telefono.replace(/\D/g, ''));
    if (new Set(telefonosReferencias).size !== telefonosReferencias.length) {
      setScanError('Las 3 referencias deben tener teléfonos distintos.');
      return;
    }

    setIsSaving(true);
    try {
      const selectedLote = lotes.find((l) => l.id === selectedLoteId);
      const loteNombreFinal =
        selectedLoteId === 'otro'
          ? customLoteNombre || 'Lote Particular'
          : selectedLote?.nombre || 'Directo Asesor';

      const estadosCuentaPayload: EstadosCuentaAnalisis = {
        mes1Url: mes1Doc || undefined,
        mes1Nombre: mes1Nombre || undefined,
        mes2Url: mes2Doc || undefined,
        mes2Nombre: mes2Nombre || undefined,
        mes3Url: mes3Doc || undefined,
        mes3Nombre: mes3Nombre || undefined,
        archivoConsolidadoUrl: consolidadoDoc || undefined,
        archivoConsolidadoNombre: consolidadoNombre || undefined,
        bancoEmisor: bancoEmisor || undefined,
        fechaSubida: new Date().toISOString(),
      };

      const payload: Partial<ExpedienteCredito> = {
        ine: ineData,
        fotoIneFrente: fotoFrente || '',
        fotoIneReverso: fotoReverso || '',
        domicilioCoincideConIne,
        comprobanteDomicilioActualUrl: comprobanteDomicilioDoc || '',
        comprobanteDomicilioActualNombre: comprobanteDomicilioNombre || '',
        tipoComprobanteDomicilio: tipoComprobante,
        estadosCuenta: estadosCuentaPayload,
        telefono,
        correo,
        ingresoMensualAprox: Number(ingresoMensual) || 0,
        tiempoViviendoDomicilio,
        casaPropiaORentada,
        tiempoEnTrabajo,
        nombreUbicacionEmpleo,
        direccionEmpleo,
        giroActividadEmpresa,
        dependientesEconomicos: Number(dependientesEconomicos) || 0,
        estadoCivil,
        referenciasPersonales: referencias,
        loteId: selectedLoteId === 'otro' ? undefined : selectedLoteId,
        loteNombre: loteNombreFinal,
        asesorLoteContacto: contactoVendedorLote || selectedLote?.contacto || '',
        telefonoLote: selectedLote?.telefono || '',
        autoMarca,
        autoModelo,
        autoAno,
        autoPrecio: Number(autoPrecio) || 0,
        enganche: calcEnganche,
        engancheModo,
        enganchePorcentaje: calcEnganchePorcentajeReal,
        montoFinanciar: calcMontoFinanciar,
        plazoMeses,
        tasaInteresAnual: 28,
        mensualidadEstimada,
        esVehiculoLegalizado,
        cuentaClabeLote: selectedLote?.cuentaClabeDefault || '',
        bancoLote: selectedLote?.bancoDefault || '',
        estatus: 'EN_EVALUACION',
        notasAsesor: `Expediente enviado a análisis con ${docsCompletadosCount} de 3 documentos reglamentarios.`,
      };

      const res = await api.createExpediente(payload);
      if (res.success && res.expediente) {
        setSavedExpediente(res.expediente);
        onExpedienteCreated(res.expediente);
      }
    } catch (err: any) {
      setScanError(err.message || 'Error al guardar el expediente.');
    } finally {
      setIsSaving(false);
    }
  };

  const copyShareLink = () => {
    if (!savedExpediente) return;
    const url = `${window.location.origin}/?tab=fondeo&folio=${savedExpediente.folio}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const openWhatsAppShare = () => {
    if (!savedExpediente) return;
    const text =
      `*CrediMóvil - Expediente Enviado a Análisis*\n` +
      `Folio: *${savedExpediente.folio}*\n` +
      `Cliente: *${savedExpediente.ine?.nombreCompleto || savedExpediente.ine?.nombre}*\n` +
      `RFC: *${savedExpediente.ine?.rfc || 'Generado'}*\n` +
      `Vehículo: *${savedExpediente.autoMarca} ${savedExpediente.autoModelo} (${savedExpediente.autoAno})*\n` +
      `Monto a Financiar: *$${savedExpediente.montoFinanciar?.toLocaleString('es-MX')} MXN*\n` +
      `Portal de Fondeo Lote: ${window.location.origin}/?tab=fondeo&folio=${savedExpediente.folio}&pin=${savedExpediente.pinFondeo}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const resetForm = () => {
    setFotoFrente(null);
    setFotoFrenteNombre('');
    setFotoReverso(null);
    setFotoReversoNombre('');
    setOcrCompleted(false);
    setScanError(null);
    setSavedExpediente(null);
    setDomicilioCoincideConIne(true);
    setComprobanteDomicilioDoc(null);
    setComprobanteDomicilioNombre('');
    setComprobanteScanSuccess(null);
    setComprobanteScanError(null);
    setMes1Doc(null);
    setMes1Nombre('');
    setMes2Doc(null);
    setMes2Nombre('');
    setMes3Doc(null);
    setMes3Nombre('');
    setConsolidadoDoc(null);
    setConsolidadoNombre('');
    setIneData({
      nombre: '',
      primerApellido: '',
      segundoApellido: '',
      nombreCompleto: '',
      curp: '',
      rfc: '',
      claveElector: '',
      fechaNacimiento: '',
      sexo: '',
      edad: undefined,
      domicilio: {
        calle: '',
        numExterior: '',
        numInterior: '',
        colonia: '',
        codigoPostal: '',
        municipio: '',
        estado: '',
        domicilioCompleto: '',
      },
      vigencia: {
        emision: '',
        vigenciaHasta: '',
        seccion: '',
      },
      ocrCic: '',
      tipoCredencial: '',
      calidadImagen: 'BUENA',
      observaciones: [],
    });
    setTelefono('');
    setCorreo('');
    setAutoMarca('');
    setAutoModelo('');
    setAutoPrecio('');
    setEngancheModo('PORCENTAJE');
    setEnganchePorcentaje(20);
    setEngancheMonto('');
    setReferencias([
      { nombre: '', telefono: '', relacion: 'Familiar (otro domicilio)', esFamiliar: true },
      { nombre: '', telefono: '', relacion: 'Conocido 1', esFamiliar: false },
      { nombre: '', telefono: '', relacion: 'Conocido 2', esFamiliar: false },
    ]);
  };

  // SUCCESS SCREEN
  if (savedExpediente) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-lg text-slate-800 relative overflow-hidden">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-5 border border-emerald-200">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-center text-slate-900 mb-2">
            ¡Expediente Guardado y Enviado a Análisis!
          </h2>
          <p className="text-center text-slate-600 text-sm max-w-xl mx-auto mb-8">
            La información del cliente, su identificación INE, comprobante de domicilio y estados de cuenta bancarios han sido guardados con seguridad en la base de datos de CrediMóvil.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Folio CrediMóvil
                </span>
                <p className="text-2xl font-mono font-black text-red-600">
                  {savedExpediente.folio}
                </p>
                <span className="inline-block mt-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                  Estatus: {savedExpediente.estatus}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  PIN de Acceso Lote
                </span>
                <p className="text-2xl font-mono font-black text-slate-900">
                  {savedExpediente.pinFondeo}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Para que el lote consulte o agregue papelería
                </p>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  RFC del Solicitante
                </span>
                <p className="text-xl font-mono font-bold text-slate-800">
                  {savedExpediente.ine?.rfc || (savedExpediente.ine?.curp ? savedExpediente.ine.curp.substring(0, 10) : 'N/A')}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 truncate">
                  {savedExpediente.ine?.nombreCompleto || savedExpediente.ine?.nombre}
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 mt-5 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Vehículo:</span>
                <strong className="text-slate-900 font-semibold">
                  {savedExpediente.autoMarca} {savedExpediente.autoModelo} ({savedExpediente.autoAno})
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Lote Aliado:</span>
                <strong className="text-slate-900 font-semibold">{savedExpediente.loteNombre}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Monto Financiado:</span>
                <strong className="text-emerald-700 font-bold">
                  ${savedExpediente.montoFinanciar?.toLocaleString('es-MX')} MXN
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Documentación:</span>
                <span className="text-slate-900 font-bold">
                  {docsCompletadosCount} de 3 adjuntos
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <button
              onClick={openWhatsAppShare}
              className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              Notificar al Lote por WhatsApp
            </button>

            <button
              onClick={copyShareLink}
              className="py-3 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copiedLink ? '¡Enlace Copiado!' : 'Copiar Enlace Directo'}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={() => onGoToFondeo(savedExpediente.folio)}
              className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <FileCheck className="w-4 h-4 text-amber-400" />
              Ver Checklist de Documentación y Fondeo
            </button>

            <button
              onClick={resetForm}
              className="py-3 px-5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer"
            >
              Capturar Nueva Solicitud
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* PROFESSIONAL EXECUTIVE HERO BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-3">
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
            Apertura de Expediente para <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-rose-400">Análisis y Fondeo</span>
          </h1>
          <p className="text-sm text-slate-300 max-w-3xl mt-2 leading-relaxed">
            Captura la información del solicitante y utiliza CrediMóvil OCR para extraer los datos de la documentación del crédito automotriz.
          </p>

          {/* 3 Pillars Summary Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-6 pt-6 border-t border-slate-800">
            <div className={`p-3.5 rounded-2xl border transition ${hasIneCompleta ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-950/60 border-slate-800 text-slate-300'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-red-400" /> 1. INE (2 Lados)
                </span>
                {hasIneCompleta ? (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> Completo
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-500">Pendiente</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Frente y reverso con extracción inteligente de nombre, CURP y RFC.
              </p>
            </div>

            <div className={`p-3.5 rounded-2xl border transition ${hasDomicilioCompleto ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-950/60 border-slate-800 text-slate-300'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-amber-400" /> 2. Comprobante Domicilio
                </span>
                {hasDomicilioCompleto ? (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> Validado
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-500">Pendiente</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Agua o Luz CFE si no coincide con el INE, con OCR y edición manual.
              </p>
            </div>

            <div className={`p-3.5 rounded-2xl border transition ${hasEstadosCuenta ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-950/60 border-slate-800 text-slate-300'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" /> 3. Estados de Cuenta (3M)
                </span>
                {hasEstadosCuenta ? (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> 3 Meses Listos
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-500">Pendiente</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Individuales mes 1, 2 y 3 o 1 archivo PDF consolidado de ingresos.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Container */}
      <form onSubmit={handleSaveExpediente} className="space-y-8">
        {/* ======================================================== */}
        {/* APARTADO DESTACADO: DOCUMENTACIÓN PARA ENVÍO A ANÁLISIS */}
        {/* ======================================================== */}
        <div className="bg-white border-2 border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-red-600 text-white text-xs font-black flex items-center justify-center">
                  1
                </span>
                <h2 className="text-lg font-black tracking-tight text-white">
                  Documentación Obligatoria para Envío a Análisis
                </h2>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                La mesa de control automotriz requiere estos 3 documentos indispensables para dictaminar el crédito.
              </p>
            </div>

            {/* Progress Badge */}
            <div className="flex items-center gap-2 bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-700 shrink-0">
              <span className="text-[11px] text-slate-400 font-semibold">Avance Documental:</span>
              <span className={`text-xs font-black ${docsCompletadosCount === 3 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {docsCompletadosCount} de 3 listos
              </span>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            {/* SUB-SECCIÓN 1.1: CREDENCIAL INE (FRENTE Y REVERSO) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-red-600" />
                    1. Identificación Oficial (INE por Ambos Lados)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sube o toma foto de la credencial vigente. El OCR extraerá automáticamente el nombre, CURP y RFC.
                  </p>
                </div>
                {hasIneCompleta && (
                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> INE Completa
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Frente */}
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 hover:border-slate-300 transition space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Frente del INE <span className="text-red-500">*</span>
                    </span>
                    {fotoFrente && (
                      <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Cargado
                      </span>
                    )}
                  </div>

                  <div className="aspect-16/10 rounded-xl bg-white border border-slate-200 overflow-hidden flex flex-col items-center justify-center relative group">
                    {fotoFrente ? (
                      <>
                        {fotoFrente.startsWith('data:application/pdf') ? (
                          <div className="p-4 text-center">
                            <FileText className="w-10 h-10 text-red-600 mx-auto mb-1" />
                            <span className="text-xs font-bold text-slate-700 block truncate max-w-[200px]">
                              {fotoFrenteNombre || 'INE_Frente.pdf'}
                            </span>
                          </div>
                        ) : (
                          <img
                            src={fotoFrente}
                            alt="Frente INE"
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewModalUrl(fotoFrente);
                              setPreviewModalTitle('Credencial INE - Frente');
                            }}
                            className="p-2 bg-white text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFotoFrente(null);
                              setFotoFrenteNombre('');
                            }}
                            className="p-2 bg-rose-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Quitar
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="p-4 text-center space-y-2">
                        <Scan className="w-8 h-8 text-slate-400 mx-auto" />
                        <p className="text-xs font-medium text-slate-600">
                          Foto o documento del Frente
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => frenteCameraInputRef.current?.click()}
                      className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Cámara Celular
                    </button>
                    <button
                      type="button"
                      onClick={() => frenteFileInputRef.current?.click()}
                      className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Subir PNG/PDF
                    </button>
                  </div>

                  {/* Hidden inputs */}
                  <input
                    type="file"
                    ref={frenteCameraInputRef}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleFileInput(e, 'frente')}
                  />
                  <input
                    type="file"
                    ref={frenteFileInputRef}
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    className="hidden"
                    onChange={(e) => handleFileInput(e, 'frente')}
                  />
                </div>

                {/* Reverso */}
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 hover:border-slate-300 transition space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Reverso del INE (Firma y Código) <span className="text-red-500">*</span>
                    </span>
                    {fotoReverso && (
                      <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Cargado
                      </span>
                    )}
                  </div>

                  <div className="aspect-16/10 rounded-xl bg-white border border-slate-200 overflow-hidden flex flex-col items-center justify-center relative group">
                    {fotoReverso ? (
                      <>
                        {fotoReverso.startsWith('data:application/pdf') ? (
                          <div className="p-4 text-center">
                            <FileText className="w-10 h-10 text-red-600 mx-auto mb-1" />
                            <span className="text-xs font-bold text-slate-700 block truncate max-w-[200px]">
                              {fotoReversoNombre || 'INE_Reverso.pdf'}
                            </span>
                          </div>
                        ) : (
                          <img
                            src={fotoReverso}
                            alt="Reverso INE"
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewModalUrl(fotoReverso);
                              setPreviewModalTitle('Credencial INE - Reverso');
                            }}
                            className="p-2 bg-white text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFotoReverso(null);
                              setFotoReversoNombre('');
                            }}
                            className="p-2 bg-rose-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Quitar
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="p-4 text-center space-y-2">
                        <Scan className="w-8 h-8 text-slate-400 mx-auto" />
                        <p className="text-xs font-medium text-slate-600">
                          Foto o documento del Reverso
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => reversoCameraInputRef.current?.click()}
                      className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Cámara Celular
                    </button>
                    <button
                      type="button"
                      onClick={() => reversoFileInputRef.current?.click()}
                      className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Subir PNG/PDF
                    </button>
                  </div>

                  {/* Hidden inputs */}
                  <input
                    type="file"
                    ref={reversoCameraInputRef}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleFileInput(e, 'reverso')}
                  />
                  <input
                    type="file"
                    ref={reversoFileInputRef}
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    className="hidden"
                    onChange={(e) => handleFileInput(e, 'reverso')}
                  />
                </div>
              </div>

              {/* Botón Escaneo OCR de la Credencial */}
              {fotoFrente && (
                <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-5 h-5 text-red-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {ocrCompleted ? '¡Datos extraídos con éxito por CrediMóvil OCR!' : 'Credencial lista para escaneo inteligente'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {ocrCompleted
                          ? 'Revisa abajo que el nombre, CURP y RFC coincidan.'
                          : 'Extrae nombres, CURP, RFC y domicilio automáticamente.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRunOcr}
                    disabled={isScanning}
                    className="py-2.5 px-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                  >
                    {isScanning ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Analizando Credencial...
                      </>
                    ) : (
                      <>
                        <Scan className="w-3.5 h-3.5" />
                        {ocrCompleted ? 'Re-escanear INE' : 'Escanear con CrediMóvil OCR'}
                      </>
                    )}
                  </button>
                </div>
              )}

              {scanError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <p>{scanError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunOcr}
                    disabled={isScanning}
                    className="py-1 px-3 bg-red-600 text-white rounded-lg text-[11px] font-bold shrink-0 transition"
                  >
                    Reintentar
                  </button>
                </div>
              )}
            </div>

            <hr className="border-slate-200" />

            {/* SUB-SECCIÓN 1.2: COMPROBANTE DE DOMICILIO (AGUA O LUZ CFE) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Home className="w-4 h-4 text-red-600" />
                    2. Comprobante de Domicilio (Recibo de AGUA o LUZ CFE)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Recibo oficial no mayor a 3 meses. El OCR leerá la dirección y completará los campos de abajo.
                  </p>
                </div>
                {hasComprobanteDomicilio && (
                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Comprobante Listo
                  </span>
                )}
              </div>

              {/* Selector si coincide con el INE o es diferente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDomicilioCoincideConIne(true)}
                  className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 cursor-pointer ${
                    domicilioCoincideConIne
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      domicilioCoincideConIne ? 'border-white bg-white text-slate-900' : 'border-slate-400'
                    }`}
                  >
                    {domicilioCoincideConIne && <Check className="w-2.5 h-2.5" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold block">
                      Vive en el mismo domicilio que la credencial INE
                    </span>
                    <span className={`text-[11px] block mt-0.5 ${domicilioCoincideConIne ? 'text-slate-300' : 'text-slate-500'}`}>
                      Se verifica con la credencial oficial
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDomicilioCoincideConIne(false)}
                  className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 cursor-pointer ${
                    !domicilioCoincideConIne
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      !domicilioCoincideConIne ? 'border-white bg-white text-slate-900' : 'border-slate-400'
                    }`}
                  >
                    {!domicilioCoincideConIne && <Check className="w-2.5 h-2.5" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold block">
                      No, el domicilio es diferente
                    </span>
                    <span className={`text-[11px] block mt-0.5 ${!domicilioCoincideConIne ? 'text-slate-300' : 'text-slate-500'}`}>
                      Se toma la dirección del recibo de agua o luz
                    </span>
                  </div>
                </button>
              </div>

              {/* Upload Card for Comprobante de Domicilio */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 space-y-3">
                {comprobanteDomicilioDoc ? (
                  <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-slate-900 truncate max-w-[260px]">
                          {comprobanteDomicilioNombre || 'Comprobante_Domicilio_Agua_Luz'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Recibo adjuntado para análisis
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        onClick={handleRunComprobanteOcr}
                        disabled={isScanningComprobante}
                        className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        {isScanningComprobante ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" /> Leyendo Recibo...
                          </>
                        ) : (
                          <>
                            <Scan className="w-3 h-3" /> Extraer Dirección con OCR
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPreviewModalUrl(comprobanteDomicilioDoc);
                          setPreviewModalTitle(`Comprobante Domicilio: ${comprobanteDomicilioNombre || 'Recibo'}`);
                        }}
                        className="py-1.5 px-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
                        title="Ver documento"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setComprobanteDomicilioDoc(null);
                          setComprobanteDomicilioNombre('');
                          setComprobanteScanSuccess(null);
                          setComprobanteScanError(null);
                        }}
                        className="py-1.5 px-2.5 bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-xs font-medium cursor-pointer"
                        title="Quitar comprobante"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 border-2 border-dashed border-slate-300 rounded-xl bg-white text-center space-y-2">
                    <FileText className="w-7 h-7 text-slate-400 mx-auto" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Cargar Recibo de AGUA o LUZ (CFE)
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Formatos soportados: Foto de cámara, archivo PNG, JPG o documento PDF
                      </p>
                    </div>

                    <div className="flex justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => comprobanteCameraInputRef.current?.click()}
                        className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Camera className="w-3.5 h-3.5" /> Tomar Foto
                      </button>
                      <button
                        type="button"
                        onClick={() => comprobanteFileInputRef.current?.click()}
                        className="py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Upload className="w-3.5 h-3.5" /> Subir Archivo
                      </button>
                    </div>
                  </div>
                )}

                {/* Hidden inputs */}
                <input
                  type="file"
                  ref={comprobanteCameraInputRef}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleComprobanteFileInput}
                />
                <input
                  type="file"
                  ref={comprobanteFileInputRef}
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  className="hidden"
                  onChange={handleComprobanteFileInput}
                />

                {comprobanteScanSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <p className="font-semibold">{comprobanteScanSuccess}</p>
                  </div>
                )}

                {comprobanteScanError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between gap-3">
                    <p>{comprobanteScanError}</p>
                    <button
                      type="button"
                      onClick={handleRunComprobanteOcr}
                      className="py-1 px-2.5 bg-slate-900 text-white rounded text-[11px] font-bold"
                    >
                      Reintentar
                    </button>
                  </div>
                )}
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* SUB-SECCIÓN 1.3: ESTADOS DE CUENTA BANCARIOS (3 MESES) */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-red-600" />
                    3. Estados de Cuenta Bancarios (Últimos 3 Meses)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Comprobación de ingresos y capacidad financiera para dictamen formal de crédito automotriz.
                  </p>
                </div>
                {hasEstadosCuenta && (
                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 self-start sm:self-auto">
                    <Check className="w-3.5 h-3.5" /> 3 Meses Listos
                  </span>
                )}
              </div>

              {/* Selector de modo: Individual vs Consolidado */}
              <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl max-w-md">
                <button
                  type="button"
                  onClick={() => setModoEstadosCuenta('individual')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                    modoEstadosCuenta === 'individual'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  3 Meses Individuales
                </button>
                <button
                  type="button"
                  onClick={() => setModoEstadosCuenta('consolidado')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                    modoEstadosCuenta === 'consolidado'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  1 Archivo PDF Consolidado
                </button>
              </div>

              {/* Opción A: 3 Meses Separados */}
              {modoEstadosCuenta === 'individual' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Mes 1 */}
                  <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        Mes 1 (Más reciente)
                      </span>
                      {mes1Doc && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    {mes1Doc ? (
                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-red-600 shrink-0" />
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {mes1Nombre || 'Mes_1.pdf'}
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewModalUrl(mes1Doc);
                              setPreviewModalTitle(`Estado de Cuenta: ${mes1Nombre}`);
                            }}
                            className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" /> Ver
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMes1Doc(null);
                              setMes1Nombre('');
                            }}
                            className="p-1 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 cursor-pointer"
                            title="Quitar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => mes1InputRef.current?.click()}
                        className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl bg-white hover:bg-slate-50 text-center space-y-1 transition cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-slate-400 mx-auto" />
                        <span className="text-xs font-bold text-slate-700 block">Subir Mes 1</span>
                        <span className="text-[10px] text-slate-400 block">PDF, PNG o JPG</span>
                      </button>
                    )}
                    <input
                      type="file"
                      ref={mes1InputRef}
                      accept="application/pdf,image/png,image/jpeg"
                      className="hidden"
                      onChange={(e) => handleBankDocInput(e, 'mes1')}
                    />
                  </div>

                  {/* Mes 2 */}
                  <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        Mes 2 (Anterior)
                      </span>
                      {mes2Doc && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    {mes2Doc ? (
                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-red-600 shrink-0" />
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {mes2Nombre || 'Mes_2.pdf'}
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewModalUrl(mes2Doc);
                              setPreviewModalTitle(`Estado de Cuenta: ${mes2Nombre}`);
                            }}
                            className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" /> Ver
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMes2Doc(null);
                              setMes2Nombre('');
                            }}
                            className="p-1 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 cursor-pointer"
                            title="Quitar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => mes2InputRef.current?.click()}
                        className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl bg-white hover:bg-slate-50 text-center space-y-1 transition cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-slate-400 mx-auto" />
                        <span className="text-xs font-bold text-slate-700 block">Subir Mes 2</span>
                        <span className="text-[10px] text-slate-400 block">PDF, PNG o JPG</span>
                      </button>
                    )}
                    <input
                      type="file"
                      ref={mes2InputRef}
                      accept="application/pdf,image/png,image/jpeg"
                      className="hidden"
                      onChange={(e) => handleBankDocInput(e, 'mes2')}
                    />
                  </div>

                  {/* Mes 3 */}
                  <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        Mes 3 (Hace 3 meses)
                      </span>
                      {mes3Doc && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    {mes3Doc ? (
                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-red-600 shrink-0" />
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {mes3Nombre || 'Mes_3.pdf'}
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewModalUrl(mes3Doc);
                              setPreviewModalTitle(`Estado de Cuenta: ${mes3Nombre}`);
                            }}
                            className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" /> Ver
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMes3Doc(null);
                              setMes3Nombre('');
                            }}
                            className="p-1 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 cursor-pointer"
                            title="Quitar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => mes3InputRef.current?.click()}
                        className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl bg-white hover:bg-slate-50 text-center space-y-1 transition cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-slate-400 mx-auto" />
                        <span className="text-xs font-bold text-slate-700 block">Subir Mes 3</span>
                        <span className="text-[10px] text-slate-400 block">PDF, PNG o JPG</span>
                      </button>
                    )}
                    <input
                      type="file"
                      ref={mes3InputRef}
                      accept="application/pdf,image/png,image/jpeg"
                      className="hidden"
                      onChange={(e) => handleBankDocInput(e, 'mes3')}
                    />
                  </div>
                </div>
              ) : (
                /* Opción B: Consolidado */
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60">
                  {consolidadoDoc ? (
                    <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="w-6 h-6 text-red-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {consolidadoNombre || 'Estados_de_Cuenta_3_Meses.pdf'}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Archivo PDF consolidado con los 3 meses completos
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewModalUrl(consolidadoDoc);
                            setPreviewModalTitle(`PDF Consolidado: ${consolidadoNombre}`);
                          }}
                          className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Ver PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConsolidadoDoc(null);
                            setConsolidadoNombre('');
                          }}
                          className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 cursor-pointer"
                          title="Quitar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => consolidadoInputRef.current?.click()}
                      className="w-full py-6 border-2 border-dashed border-slate-300 rounded-xl bg-white hover:bg-slate-50 text-center space-y-1 transition cursor-pointer"
                    >
                      <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                      <span className="text-xs font-bold text-slate-800 block">
                        Subir PDF Consolidado de los 3 Meses
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Un solo archivo con los últimos 3 estados de cuenta completos
                      </span>
                    </button>
                  )}
                  <input
                    type="file"
                    ref={consolidadoInputRef}
                    accept="application/pdf,image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => handleBankDocInput(e, 'consolidado')}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECCIÓN 2: DATOS DEL CLIENTE (OCR Y EDICIÓN DIRECTA)   */}
        {/* ======================================================== */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-black flex items-center justify-center">
                  2
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Datos Oficiales del Solicitante (Cotejo INE y RFC)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Validados mediante el OCR de CrediMóvil. Puedes editarlos directamente si requieres corregir algún dato.
              </p>
            </div>
            {ocrCompleted && (
              <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                ✓ OCR Validado
              </span>
            )}
          </div>

          <div className="space-y-4">
            {/* Nombres y Apellidos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nombre(s) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={ineData.nombre}
                  onChange={(e) => setIneData({ ...ineData, nombre: e.target.value })}
                  placeholder="ej. CARLOS"
                  className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Primer Apellido (Paterno) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={ineData.primerApellido}
                  onChange={(e) => setIneData({ ...ineData, primerApellido: e.target.value })}
                  placeholder="ej. GONZALEZ"
                  className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Segundo Apellido (Materno)
                </label>
                <input
                  type="text"
                  value={ineData.segundoApellido}
                  onChange={(e) => setIneData({ ...ineData, segundoApellido: e.target.value })}
                  placeholder="ej. TREVIÑO"
                  className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>

            {/* CURP, RFC del Cliente, Fecha Nacimiento, Sexo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  CURP (18 Dígitos) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={18}
                  value={ineData.curp}
                  onChange={(e) => {
                    const newCurp = e.target.value.toUpperCase();
                    const prevBase = ineData.curp ? ineData.curp.substring(0, 10) : '';
                    const shouldAutoUpdate = !ineData.rfc || ineData.rfc === prevBase;
                    const nextRfc = shouldAutoUpdate && newCurp.length >= 10 ? newCurp.substring(0, 10) : (ineData.rfc || (newCurp.length >= 10 ? newCurp.substring(0, 10) : ''));
                    setIneData({ ...ineData, curp: newCurp, rfc: nextRfc });
                  }}
                  placeholder="GOTC850412HNL..."
                  className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono text-sm uppercase font-semibold focus:border-slate-900 focus:outline-none"
                />
              </div>

              {/* RFC del Cliente */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    RFC del Cliente <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const autoRfc = calcularRfcBase(
                        ineData.curp,
                        ineData.nombre,
                        ineData.primerApellido,
                        ineData.segundoApellido,
                        ineData.fechaNacimiento
                      );
                      setIneData({ ...ineData, rfc: autoRfc });
                    }}
                    className="text-[10px] text-amber-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
                    title="Calcular con base en el CURP"
                  >
                    <Sparkles className="w-3 h-3" /> Auto-generar
                  </button>
                </div>
                <input
                  type="text"
                  required
                  maxLength={13}
                  value={ineData.rfc || ''}
                  onChange={(e) => setIneData({ ...ineData, rfc: e.target.value.toUpperCase() })}
                  placeholder="ej. GOTC850412XXX"
                  className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono text-sm uppercase font-bold tracking-wider focus:border-slate-900 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Se genera automáticamente con los primeros 10 caracteres del CURP. Puedes agregar manualmente la homoclave SAT.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Fecha de Nacimiento
                </label>
                <input
                  type="text"
                  value={ineData.fechaNacimiento}
                  onChange={(e) => setIneData({ ...ineData, fechaNacimiento: e.target.value })}
                  placeholder="YYYY-MM-DD"
                  className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Sexo
                </label>
                <select
                  value={ineData.sexo || ''}
                  onChange={(e) => setIneData({ ...ineData, sexo: e.target.value as any })}
                  className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
                >
                  <option value="">Seleccionar...</option>
                  <option value="H">Hombre (H)</option>
                  <option value="M">Mujer (M)</option>
                  <option value="X">No Binario (X)</option>
                </select>
              </div>
            </div>

            {/* Domicilio editable */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {domicilioCoincideConIne
                    ? 'Domicilio Oficial (Registrado en INE)'
                    : 'Domicilio Actual (del Comprobante de Agua o Luz)'}
                </label>
                <span className="text-[11px] text-slate-500">
                  Puedes editar directamente cualquier campo abajo
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Calle</label>
                  <input
                    type="text"
                    value={ineData.domicilio?.calle || ''}
                    onChange={(e) =>
                      setIneData({
                        ...ineData,
                        domicilio: { ...ineData.domicilio, calle: e.target.value },
                      })
                    }
                    placeholder="ej. AV. BENITO JUAREZ"
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">No. Ext.</label>
                    <input
                      type="text"
                      value={ineData.domicilio?.numExterior || ''}
                      onChange={(e) =>
                        setIneData({
                          ...ineData,
                          domicilio: { ...ineData.domicilio, numExterior: e.target.value },
                        })
                      }
                      placeholder="100"
                      className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">No. Int.</label>
                    <input
                      type="text"
                      value={ineData.domicilio?.numInterior || ''}
                      onChange={(e) =>
                        setIneData({
                          ...ineData,
                          domicilio: { ...ineData.domicilio, numInterior: e.target.value },
                        })
                      }
                      placeholder="Sin número"
                      className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Colonia</label>
                  <input
                    type="text"
                    value={ineData.domicilio?.colonia || ''}
                    onChange={(e) =>
                      setIneData({
                        ...ineData,
                        domicilio: { ...ineData.domicilio, colonia: e.target.value },
                      })
                    }
                    placeholder="CENTRO"
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Código Postal</label>
                  <input
                    type="text"
                    maxLength={5}
                    value={ineData.domicilio?.codigoPostal || ''}
                    onChange={(e) =>
                      setIneData({
                        ...ineData,
                        domicilio: { ...ineData.domicilio, codigoPostal: e.target.value },
                      })
                    }
                    placeholder="64000"
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Municipio</label>
                  <input
                    type="text"
                    value={ineData.domicilio?.municipio || ''}
                    onChange={(e) =>
                      setIneData({
                        ...ineData,
                        domicilio: { ...ineData.domicilio, municipio: e.target.value },
                      })
                    }
                    placeholder="MONTERREY"
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Estado</label>
                  <input
                    type="text"
                    value={ineData.domicilio?.estado || ''}
                    onChange={(e) =>
                      setIneData({
                        ...ineData,
                        domicilio: { ...ineData.domicilio, estado: e.target.value },
                      })
                    }
                    placeholder="NUEVO LEON"
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECCIÓN 3: PERFIL SOCIOECONÓMICO Y LABORAL (CREDIMÓVIL)  */}
        {/* ======================================================== */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-200">
            <span className="w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-black flex items-center justify-center">
              3
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Perfil Socioeconómico y Laboral
              </h3>
              <p className="text-xs text-slate-500">
                Información de contacto, empleo y referencias personales para el dictamen
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Teléfono de Contacto <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="81 1234 5678"
                className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="cliente@ejemplo.com"
                className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Ingreso Mensual Comprobable ($MXN)
              </label>
              <input
                type="number"
                value={ingresoMensual}
                onChange={(e) => setIngresoMensual(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="ej. 35000"
                className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Vivienda
              </label>
              <select
                value={casaPropiaORentada}
                onChange={(e) => setCasaPropiaORentada(e.target.value as any)}
                className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="">Seleccionar condición...</option>
                <option value="PROPIA">Casa Propia</option>
                <option value="RENTADA">Rentada</option>
                <option value="FAMILIAR">Casa Familiar</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Antigüedad en domicilio
              </label>
              <input
                type="text"
                value={tiempoViviendoDomicilio}
                onChange={(e) => setTiempoViviendoDomicilio(e.target.value)}
                placeholder="ej. 5 años"
                className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Empresa / Lugar de Trabajo
              </label>
              <input
                type="text"
                value={nombreUbicacionEmpleo}
                onChange={(e) => setNombreUbicacionEmpleo(e.target.value)}
                placeholder="ej. Nemak México"
                className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Dirección del empleo
              </label>
              <input
                type="text"
                value={direccionEmpleo}
                onChange={(e) => setDireccionEmpleo(e.target.value)}
                placeholder="Calle, número, colonia, municipio, estado"
                className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Antigüedad en Empleo
              </label>
              <input
                type="text"
                value={tiempoEnTrabajo}
                onChange={(e) => setTiempoEnTrabajo(e.target.value)}
                placeholder="ej. 3 años"
                className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* Referencias personales obligatorias */}
          <div className="pt-2 border-t border-slate-200 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-red-600" />
                  3 Referencias Personales <span className="text-red-500">*</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  1 familiar que viva en otro domicilio y 2 conocidos. Solo se solicita nombre y teléfono.
                </p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 border border-red-100 px-2 py-1 rounded-lg">
                Obligatorio
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {referencias.map((ref, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                      Referencia {index + 1}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      ref.esFamiliar
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {ref.esFamiliar ? 'Familiar • otro domicilio' : ref.relacion}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Nombre completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={ref.nombre}
                      onChange={(e) =>
                        setReferencias((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, nombre: e.target.value } : item))
                        )
                      }
                      placeholder="Nombre de la referencia"
                      className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Teléfono *
                    </label>
                    <input
                      type="tel"
                      required
                      value={ref.telefono}
                      onChange={(e) =>
                        setReferencias((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, telefono: e.target.value } : item))
                        )
                      }
                      placeholder="81 1234 5678"
                      className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
                    />
                  </div>


                </div>
              ))}
            </div>
          </div>

        {/* SECCIÓN 4: DATOS DEL VEHÍCULO Y LOTE ASOCIADO           */}
        {/* ======================================================== */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-200">
            <span className="w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-black flex items-center justify-center">
              4
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Unidad a Financiar y Lote de Autos
              </h3>
              <p className="text-xs text-slate-500">
                Términos del vehículo y vinculación directa con el lote aliado sin intermediarios
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Lote Aliado Asociado <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedLoteId}
                onChange={(e) => setSelectedLoteId(e.target.value)}
                className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
              >
                {lotes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
                <option value="otro">Otro Lote (Escribir manual)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Marca del Auto <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={autoMarca}
                onChange={(e) => setAutoMarca(e.target.value)}
                placeholder="ej. Mazda, Honda, Nissan"
                className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Modelo / Versión <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={autoModelo}
                onChange={(e) => setAutoModelo(e.target.value)}
                placeholder="ej. Mazda 3 i Grand Touring"
                className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Año / Modelo
              </label>
              <input
                type="number"
                value={autoAno}
                onChange={(e) => setAutoAno(Number(e.target.value))}
                className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Precio de Venta ($MXN) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                value={autoPrecio}
                onChange={(e) => setAutoPrecio(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="ej. 320000"
                className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Enganche <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setEngancheModo('PORCENTAJE');
                    if (!enganchePorcentaje) setEnganchePorcentaje(20);
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition ${
                    engancheModo === 'PORCENTAJE'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-slate-600 border-slate-300'
                  }`}
                >
                  Porcentaje (%)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEngancheModo('MONTO');
                    setEngancheMonto(engancheMonto === '' ? calcEnganche : engancheMonto);
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition ${
                    engancheModo === 'MONTO'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-slate-600 border-slate-300'
                  }`}
                >
                  Monto en efectivo ($)
                </button>
              </div>

              {engancheModo === 'PORCENTAJE' ? (
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={20}
                    max={100}
                    step={0.01}
                    value={enganchePorcentajeSeguro}
                    onChange={(e) => {
                      const value = Number(e.target.value) || 20;
                      setEnganchePorcentaje(Math.min(100, Math.max(20, value)));
                    }}
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:border-slate-900 focus:outline-none"
                  />
                  <div className="py-2 px-3 bg-slate-100 border border-slate-300 rounded-xl text-slate-700 text-sm font-bold">
                    %
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="py-2 px-3 bg-slate-100 border border-slate-300 rounded-xl text-slate-700 text-sm font-bold">
                    $
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={precioSeguro > 0 ? precioSeguro : undefined}
                    step={1}
                    value={engancheMonto === '' ? '' : engancheMonto}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setEngancheMonto('');
                        return;
                      }
                      const value = Number(raw);
                      if (!Number.isFinite(value)) return;
                      setEngancheMonto(precioSeguro > 0 ? Math.min(precioSeguro, Math.max(0, value)) : Math.max(0, value));
                    }}
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:border-slate-900 focus:outline-none"
                  />
                </div>
              )}

              <p className="text-[10px] text-slate-500 mt-1">
                En efectivo: monto libre • Equivalente informativo: {calcEnganchePorcentajeReal}% del valor
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Plazo (Meses)
              </label>
              <select
                value={plazoMeses}
                onChange={(e) => setPlazoMeses(Number(e.target.value))}
                className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:border-slate-900 focus:outline-none"
              >
                <option value={12}>12 Meses (1 Año)</option>
                <option value={24}>24 Meses (2 Años)</option>
                <option value={36}>36 Meses (3 Años)</option>
                <option value={48}>48 Meses (4 Años)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Monto a Financiar
              </label>
              <div className="py-2 px-3 bg-slate-100 border border-slate-300 rounded-xl text-emerald-800 text-sm font-bold">
                ${calcMontoFinanciar.toLocaleString('es-MX')} MXN
              </div>
            </div>
          </div>

          {/* Legalizado switch */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                ¿Es vehículo legalizado (importado de USA)?
              </span>
              <span className="text-[11px] text-slate-500 block">
                Si está marcado, requerirá Pedimento y Título de propiedad en el checklist de fondeo.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={esVehiculoLegalizado}
                onChange={(e) => setEsVehiculoLegalizado(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-4 z-20">
          <div className="text-xs text-slate-600">
            <span className="font-bold text-slate-900 block">
              Envío directo a análisis sin intermediarios
            </span>
            <span>
              {docsCompletadosCount === 3
                ? '✓ Los 3 documentos obligatorios están listos para dictamen'
                : `Se han cargado ${docsCompletadosCount} de los 3 documentos obligatorios`}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={resetForm}
              className="py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Limpiar Campos
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 sm:flex-initial py-3 px-6 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Guardando en Base de Datos...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 text-emerald-400" />
                  Guardar y Enviar a Análisis
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* DOCUMENT PREVIEW MODAL */}
      {previewModalUrl && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 truncate">
                {previewModalTitle}
              </h4>
              <button
                type="button"
                onClick={() => setPreviewModalUrl(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-slate-100">
              {previewModalUrl.startsWith('data:application/pdf') ? (
                <iframe
                  src={previewModalUrl}
                  title="PDF Preview"
                  className="w-full h-[70vh] border-0 rounded-xl"
                />
              ) : (
                <img
                  src={previewModalUrl}
                  alt="Vista previa"
                  className="max-h-[70vh] object-contain rounded-xl shadow-xs"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Camera Capture Modal fallback */}
      <CameraCaptureModal
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCapture}
        sideText={cameraSide === 'frente' ? 'Anverso (Frente)' : 'Reverso'}
      />
    </div>
  );
};
