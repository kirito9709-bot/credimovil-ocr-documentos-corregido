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

  // 3. Estados de Cuenta de los últimos 3 meses (Opcional)
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
  const [previewRenderableUrl, setPreviewRenderableUrl] = useState<string | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState<string>('');

  useEffect(() => {
    let objectUrl: string | null = null;

    if (!previewModalUrl) {
      setPreviewRenderableUrl(null);
      setPreviewMimeType('');
      return () => {};
    }

    const buildPreviewUrl = () => {
      if (!previewModalUrl.startsWith('data:')) {
        const inferredMime =
          /\.pdf(?:$|[?#])/i.test(previewModalUrl)
            ? 'application/pdf'
            : '';
        setPreviewRenderableUrl(previewModalUrl);
        setPreviewMimeType(inferredMime);
        return;
      }

      try {
        const commaIndex = previewModalUrl.indexOf(',');
        if (commaIndex < 0) throw new Error('Data URI inválido.');

        const metadata = previewModalUrl.slice(0, commaIndex);
        const payload = previewModalUrl.slice(commaIndex + 1);
        const mimeMatch = metadata.match(/^data:([^;]+)/i);
        const mimeType = mimeMatch?.[1] || 'application/octet-stream';

        let bytes: Uint8Array;
        if (/;base64/i.test(metadata)) {
          const binary = window.atob(payload);
          bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        } else {
          bytes = new TextEncoder().encode(decodeURIComponent(payload));
        }

        objectUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
        setPreviewRenderableUrl(objectUrl);
        setPreviewMimeType(mimeType);
      } catch (error) {
        console.error('No se pudo preparar la vista previa:', error);
        setPreviewRenderableUrl(null);
        setPreviewMimeType('');
      }
    };

    buildPreviewUrl();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewModalUrl]);

  // 4. Checklist Inicio de Crédito Automotriz (CrediMóvil)
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [ingresoMensual, setIngresoMensual] = useState<number | ''>('');
  const [tiempoViviendoDomicilio, setTiempoViviendoDomicilio] = useState('');
  const [casaPropiaORentada, setCasaPropiaORentada] = useState<'PROPIA' | 'RENTADA' | 'FAMILIAR' | ''>('');
  const [tiempoEnTrabajo, setTiempoEnTrabajo] = useState('');
  const [nombreUbicacionEmpleo, setNombreUbicacionEmpleo] = useState('');
  const [direccionEmpleo, setDireccionEmpleo] = useState('');
  const [nominas, setNominas] = useState<Array<{ archivoUrl: string; archivoNombre: string; archivoTipo?: string; archivoTamano?: number; fechaSubida?: string }>>([]);
  const [dependientesEconomicos, setDependientesEconomicos] = useState<number>(0);
  const [estadoCivil, setEstadoCivil] = useState<'SOLTERO' | 'CASADO' | 'UNION_LIBRE' | 'DIVORCIADO' | 'VIUDO' | ''>('SOLTERO');

  // Obligado solidario: misma documentación inicial que el solicitante, adjunta al mismo expediente.
  const [requiereObligadoSolidario, setRequiereObligadoSolidario] = useState(false);
  const [obligadoNombre, setObligadoNombre] = useState('');
  const [obligadoCurp, setObligadoCurp] = useState('');
  const [obligadoRfc, setObligadoRfc] = useState('');
  const [obligadoFechaNacimiento, setObligadoFechaNacimiento] = useState('');
  const [obligadoSexo, setObligadoSexo] = useState('');
  const [obligadoTelefono, setObligadoTelefono] = useState('');
  const [obligadoCorreo, setObligadoCorreo] = useState('');
  const [obligadoIngresoMensual, setObligadoIngresoMensual] = useState<number | ''>('');
  const [obligadoTiempoViviendoDomicilio, setObligadoTiempoViviendoDomicilio] = useState('');
  const [obligadoCasaPropiaORentada, setObligadoCasaPropiaORentada] = useState<'PROPIA' | 'RENTADA' | 'FAMILIAR' | ''>('');
  const [obligadoTiempoEnTrabajo, setObligadoTiempoEnTrabajo] = useState('');
  const [obligadoNombreUbicacionEmpleo, setObligadoNombreUbicacionEmpleo] = useState('');
  const [obligadoDireccionEmpleo, setObligadoDireccionEmpleo] = useState('');
  const [obligadoDomicilio, setObligadoDomicilio] = useState<IneData['domicilio']>({
    calle: '',
    numExterior: '',
    numInterior: '',
    colonia: '',
    codigoPostal: '',
    municipio: '',
    estado: '',
    domicilioCompleto: '',
  });
  const [obligadoDomicilioOcrLoading, setObligadoDomicilioOcrLoading] = useState(false);
  const [obligadoDomicilioOcrError, setObligadoDomicilioOcrError] = useState<string | null>(null);
  const [obligadoDomicilioOcrSuccess, setObligadoDomicilioOcrSuccess] = useState<string | null>(null);
  const [obligadoDependientesEconomicos, setObligadoDependientesEconomicos] = useState<number>(0);
  const [obligadoEstadoCivil, setObligadoEstadoCivil] = useState<'SOLTERO' | 'CASADO' | 'UNION_LIBRE' | 'DIVORCIADO' | 'VIUDO' | ''>('');
  const [obligadoReferencias, setObligadoReferencias] = useState<ReferenciaPersonal[]>([
    { nombre: '', telefono: '', relacion: 'Familiar (otro domicilio)', esFamiliar: true },
    { nombre: '', telefono: '', relacion: 'Conocido 1', esFamiliar: false },
    { nombre: '', telefono: '', relacion: 'Conocido 2', esFamiliar: false },
  ]);
  const [obligadoIneFrente, setObligadoIneFrente] = useState<string | null>(null);
  const [obligadoIneFrenteNombre, setObligadoIneFrenteNombre] = useState('');
  const [obligadoIneReverso, setObligadoIneReverso] = useState<string | null>(null);
  const [obligadoIneReversoNombre, setObligadoIneReversoNombre] = useState('');
  const [isScanningObligado, setIsScanningObligado] = useState(false);
  const [obligadoOcrError, setObligadoOcrError] = useState<string | null>(null);
  const [obligadoComprobante, setObligadoComprobante] = useState<string | null>(null);
  const [obligadoComprobanteNombre, setObligadoComprobanteNombre] = useState('');
  const [obligadoMes1, setObligadoMes1] = useState<string | null>(null);
  const [obligadoMes1Nombre, setObligadoMes1Nombre] = useState('');
  const [obligadoMes2, setObligadoMes2] = useState<string | null>(null);
  const [obligadoMes2Nombre, setObligadoMes2Nombre] = useState('');
  const [obligadoMes3, setObligadoMes3] = useState<string | null>(null);
  const [obligadoMes3Nombre, setObligadoMes3Nombre] = useState('');
  const [obligadoConsolidado, setObligadoConsolidado] = useState<string | null>(null);
  const [obligadoConsolidadoNombre, setObligadoConsolidadoNombre] = useState('');
  const [obligadoNominas, setObligadoNominas] = useState<Array<{ archivoUrl: string; archivoNombre: string; archivoTipo?: string; archivoTamano?: number; fechaSubida?: string }>>([]);
  const obligadoIneFrenteInput = useRef<HTMLInputElement | null>(null);
  const obligadoIneReversoInput = useRef<HTMLInputElement | null>(null);
  const obligadoComprobanteInput = useRef<HTMLInputElement | null>(null);
  const obligadoMes1Input = useRef<HTMLInputElement | null>(null);
  const obligadoMes2Input = useRef<HTMLInputElement | null>(null);
  const obligadoMes3Input = useRef<HTMLInputElement | null>(null);
  const obligadoConsolidadoInput = useRef<HTMLInputElement | null>(null);
  const obligadoNominaInputRef = useRef<HTMLInputElement | null>(null);

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
  const nominaInputRef = useRef<HTMLInputElement | null>(null);

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

  const updateDomicilioField = (field: keyof IneData['domicilio'], value: string) => {
    setIneData((prev) => {
      const domicilio = { ...prev.domicilio, [field]: value };
      domicilio.domicilioCompleto = [
        domicilio.calle,
        domicilio.numExterior ? `#${domicilio.numExterior}` : '',
        domicilio.numInterior ? `Int. ${domicilio.numInterior}` : '',
        domicilio.colonia ? `Col. ${domicilio.colonia}` : '',
        domicilio.codigoPostal ? `C.P. ${domicilio.codigoPostal}` : '',
        domicilio.municipio,
        domicilio.estado,
      ].filter(Boolean).join(', ');
      return { ...prev, domicilio };
    });
  };

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

  const handleObligadoFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (value: string | null) => void,
    nameSetter: (value: string) => void,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setter(reader.result);
        nameSetter(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleNominaFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';

    if (!files.length) return;

    const available = Math.max(0, 3 - nominas.length);
    if (available <= 0) {
      setScanError('Puedes adjuntar hasta 3 comprobantes de nómina.');
      return;
    }

    const selected = files.slice(0, available);
    const invalidType = selected.find((file) => !/^(application\/pdf|image\/png|image\/jpeg|image\/webp)$/i.test(file.type));
    if (invalidType) {
      setScanError('Las nóminas deben ser PDF, PNG, JPG o WEBP.');
      return;
    }

    const oversized = selected.find((file) => file.size > 10 * 1024 * 1024);
    if (oversized) {
      setScanError('Cada comprobante de nómina puede pesar máximo 10 MB.');
      return;
    }

    Promise.all(
      selected.map((file) => new Promise<{ archivoUrl: string; archivoNombre: string; archivoTipo: string; archivoTamano: number }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve({
              archivoUrl: reader.result,
              archivoNombre: file.name,
              archivoTipo: file.type,
              archivoTamano: file.size,
            });
          } else {
            reject(new Error('No se pudo leer el comprobante de nómina.'));
          }
        };
        reader.onerror = () => reject(new Error('No se pudo leer el comprobante de nómina.'));
        reader.readAsDataURL(file);
      }))
    )
      .then((items) => {
        setNominas((prev) => [...prev, ...items].slice(0, 3));
        setScanError(null);
      })
      .catch((error: any) => {
        setScanError(error?.message || 'No se pudieron cargar las nóminas.');
      });
  };

  const handleRunObligadoOcr = async () => {
    if (!obligadoIneFrente) {
      setObligadoOcrError('Sube primero el frente del INE del obligado solidario.');
      return;
    }

    setIsScanningObligado(true);
    setObligadoOcrError(null);

    try {
      const res = await api.scanIne(obligadoIneFrente, obligadoIneReverso || undefined);
      if (!res.success || !res.data) {
        throw new Error(res.message || 'No se pudieron extraer los datos del obligado solidario.');
      }

      const data = res.data;
      let finalRfc = data.rfc || '';
      if (!finalRfc || finalRfc.length < 10) {
        finalRfc = calcularRfcBase(
          data.curp,
          data.nombre,
          data.primerApellido,
          data.segundoApellido,
          data.fechaNacimiento
        );
      }

      const nombreCompleto = data.nombreCompleto ||
        [data.nombre, data.primerApellido, data.segundoApellido].filter(Boolean).join(' ').trim();

      setObligadoNombre(nombreCompleto);
      setObligadoCurp(data.curp || '');
      setObligadoRfc(finalRfc);
      setObligadoFechaNacimiento(data.fechaNacimiento || '');
      setObligadoSexo(data.sexo || '');
    } catch (error: any) {
      console.error(error);
      setObligadoOcrError(
        error?.message ||
        'No se pudo leer el INE del obligado solidario. Puedes capturar los datos manualmente.'
      );
    } finally {
      setIsScanningObligado(false);
    }
  };

  const handleObligadoNominaFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    const available = Math.max(0, 3 - obligadoNominas.length);
    if (available <= 0) {
      setObligadoOcrError('Puedes adjuntar hasta 3 comprobantes de nómina para el obligado.');
      return;
    }

    const selected = files.slice(0, available);
    const invalid = selected.find((file) => !/^(application\/pdf|image\/png|image\/jpeg|image\/webp)$/i.test(file.type));
    if (invalid) {
      setObligadoOcrError('Las nóminas deben ser PDF, PNG, JPG o WEBP.');
      return;
    }

    const oversized = selected.find((file) => file.size > 10 * 1024 * 1024);
    if (oversized) {
      setObligadoOcrError('Cada nómina puede pesar máximo 10 MB.');
      return;
    }

    Promise.all(selected.map((file) => new Promise<any>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string'
        ? resolve({
            archivoUrl: reader.result,
            archivoNombre: file.name,
            archivoTipo: file.type,
            archivoTamano: file.size,
            fechaSubida: new Date().toISOString(),
          })
        : reject(new Error('No se pudo leer la nómina.'));
      reader.onerror = () => reject(new Error('No se pudo leer la nómina.'));
      reader.readAsDataURL(file);
    }))).then((items) => {
      setObligadoNominas((prev) => [...prev, ...items].slice(0, 3));
      setObligadoOcrError(null);
    }).catch((error: any) => {
      setObligadoOcrError(error?.message || 'No se pudieron cargar las nóminas.');
    });
  };

  const handleRunObligadoComprobanteOcr = async () => {
    if (!obligadoComprobante) {
      setObligadoDomicilioOcrError('Sube primero el comprobante de domicilio del obligado solidario.');
      return;
    }

    setObligadoDomicilioOcrLoading(true);
    setObligadoDomicilioOcrError(null);
    setObligadoDomicilioOcrSuccess(null);

    try {
      const res = await api.scanComprobanteDomicilio(obligadoComprobante);
      if (!res.success || !res.data) {
        throw new Error(res.message || 'No se pudo leer el comprobante de domicilio del obligado.');
      }

      const data = res.data;
      const domicilio = {
        calle: String(data.calle || ''),
        numExterior: String(data.numExterior || ''),
        numInterior: String(data.numInterior || ''),
        colonia: String(data.colonia || ''),
        codigoPostal: String(data.codigoPostal || ''),
        municipio: String(data.municipio || ''),
        estado: String(data.estado || ''),
        domicilioCompleto: String(
          data.domicilioCompleto ||
          [
            data.calle,
            data.numExterior ? `#${data.numExterior}` : '',
            data.numInterior ? `Int. ${data.numInterior}` : '',
            data.colonia ? `Col. ${data.colonia}` : '',
            data.codigoPostal ? `C.P. ${data.codigoPostal}` : '',
            data.municipio,
            data.estado,
          ].filter(Boolean).join(', ')
        ),
      };

      setObligadoDomicilio(domicilio);
      setObligadoDomicilioOcrSuccess(
        `${data.companiaEmisora || 'Comprobante'} leído correctamente. Dirección extraída: ${domicilio.domicilioCompleto || 'revisa los campos'}.`
      );
    } catch (error: any) {
      console.error(error);
      setObligadoDomicilioOcrError(
        error?.message ||
        'No se pudo leer el comprobante de domicilio del obligado. Puedes capturar el domicilio manualmente.'
      );
    } finally {
      setObligadoDomicilioOcrLoading(false);
    }
  };

  // Readiness evaluation for analysis
  const hasIneCompleta = Boolean(fotoFrente && fotoReverso);
  const hasComprobanteDomicilio = Boolean(comprobanteDomicilioDoc);
  const hasDomicilioCompleto = !domicilioCoincideConIne
    ? Boolean(comprobanteDomicilioDoc)
    : Boolean(ineData.domicilio?.calle || ocrCompleted || fotoFrente);
  const hasEstadosCuenta = modoEstadosCuenta === 'consolidado' ? Boolean(consolidadoDoc) : Boolean(mes1Doc || mes2Doc || mes3Doc);
  const hasObligadoIne = Boolean(obligadoIneFrente && obligadoIneReverso);
  const hasObligadoComprobante = Boolean(obligadoComprobante);
  const hasObligadoEstados = modoEstadosCuenta === 'consolidado'
    ? Boolean(obligadoConsolidado)
    : Boolean(obligadoMes1 || obligadoMes2 || obligadoMes3);
  const obligadoReferenciasIncompletas = obligadoReferencias.some((r) => !r.nombre.trim() || !r.telefono.trim());
  const obligadoSolidarioCompleto =
    !requiereObligadoSolidario ||
    Boolean(
      obligadoNombre.trim() &&
      obligadoTelefono.replace(/\D/g, '').length >= 10 &&
      obligadoIngresoMensual !== '' &&
      obligadoTiempoViviendoDomicilio.trim() &&
      obligadoCasaPropiaORentada &&
      obligadoTiempoEnTrabajo.trim() &&
      obligadoNombreUbicacionEmpleo.trim() &&
      obligadoDireccionEmpleo.trim() &&
      obligadoEstadoCivil &&
      !obligadoReferenciasIncompletas &&
      new Set(obligadoReferencias.map((r) => r.telefono.replace(/\D/g, ''))).size === 3 &&
      hasObligadoIne &&
      hasObligadoComprobante
    );

  let docsCompletadosCount = 0;
  if (hasIneCompleta) docsCompletadosCount++;
  if (hasDomicilioCompleto) docsCompletadosCount++;
  // Los estados de cuenta son opcionales y no incrementan los documentos obligatorios.

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

    if (requiereObligadoSolidario && !obligadoSolidarioCompleto) {
      setScanError('El obligado solidario debe capturar los datos socioeconómicos y de contacto, las 3 referencias, INE ambos lados y comprobante de domicilio. Los estados de cuenta son opcionales.');
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
        nominas: nominas.map((doc) => ({
          archivoUrl: doc.archivoUrl,
          archivoNombre: doc.archivoNombre,
          archivoTipo: doc.archivoTipo,
          archivoTamano: doc.archivoTamano,
          fechaSubida: new Date().toISOString(),
        })),
        telefono,
        correo,
        ingresoMensualAprox: Number(ingresoMensual) || 0,
        tiempoViviendoDomicilio,
        casaPropiaORentada,
        tiempoEnTrabajo,
        nombreUbicacionEmpleo,
        direccionEmpleo,
        dependientesEconomicos: Number(dependientesEconomicos) || 0,
        estadoCivil,
        referenciasPersonales: referencias,
        obligadoSolidario: requiereObligadoSolidario ? {

          telefono: obligadoTelefono.trim(),
          correo: obligadoCorreo.trim(),
          ingresoMensualAprox: Number(obligadoIngresoMensual) || 0,
          tiempoViviendoDomicilio: obligadoTiempoViviendoDomicilio.trim(),
          casaPropiaORentada: obligadoCasaPropiaORentada,
          tiempoEnTrabajo: obligadoTiempoEnTrabajo.trim(),
          nombreUbicacionEmpleo: obligadoNombreUbicacionEmpleo.trim(),
          direccionEmpleo: obligadoDireccionEmpleo.trim(),
          domicilio: obligadoDomicilio,
          dependientesEconomicos: Number(obligadoDependientesEconomicos) || 0,
          estadoCivil: obligadoEstadoCivil,
          referenciasPersonales: obligadoReferencias,

          requerido: true,
          nombre: obligadoNombre.trim(),
          fotoIneFrente: obligadoIneFrente || '',
          fotoIneFrenteNombre: obligadoIneFrenteNombre || '',
          fotoIneReverso: obligadoIneReverso || '',
          fotoIneReversoNombre: obligadoIneReversoNombre || '',
          comprobanteDomicilioUrl: obligadoComprobante || '',
          comprobanteDomicilioNombre: obligadoComprobanteNombre || '',
          estadosCuenta: modoEstadosCuenta === 'consolidado'
            ? {
                archivoConsolidadoUrl: obligadoConsolidado || undefined,
                archivoConsolidadoNombre: obligadoConsolidadoNombre || undefined,
                fechaSubida: new Date().toISOString(),
              }
            : {
                mes1Url: obligadoMes1 || undefined,
                mes1Nombre: obligadoMes1Nombre || undefined,
                mes2Url: obligadoMes2 || undefined,
                mes2Nombre: obligadoMes2Nombre || undefined,
                mes3Url: obligadoMes3 || undefined,
                mes3Nombre: obligadoMes3Nombre || undefined,
                fechaSubida: new Date().toISOString(),
              },
          nominas: obligadoNominas.map((doc) => ({
            archivoUrl: doc.archivoUrl,
            archivoNombre: doc.archivoNombre,
            archivoTipo: doc.archivoTipo,
            archivoTamano: doc.archivoTamano,
            fechaSubida: doc.fechaSubida || new Date().toISOString(),
          })),
        } : { requerido: false },
        loteId: selectedLoteId === 'otro' ? undefined : selectedLoteId,
        loteNombre: loteNombreFinal,
        asesorLoteContacto: contactoVendedorLote || selectedLote?.contacto || '',
        telefonoLote: selectedLote?.telefono || '',
        correoLote: selectedLote?.correo || '',
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
        estatus: 'NUEVO',
        notasAsesor: `Expediente enviado directamente al asesor con ${docsCompletadosCount} de 3 documentos reglamentarios.`,
      };

      const res = await api.createExpediente(payload);

      if (!res?.success) {
        throw new Error(res?.message || 'El servidor no confirmó la creación del expediente.');
      }

      if (!res.expediente) {
        throw new Error('El expediente se guardó, pero el servidor no devolvió los datos del expediente.');
      }

      setSavedExpediente(res.expediente);
      onExpedienteCreated(res.expediente);
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
      `*CrediMóvil - Expediente Enviado al Asesor*\n` +
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
    setNominas([]);
    setObligadoNominas([]);
    setIsScanningObligado(false);
    setObligadoOcrError(null);
    setObligadoDomicilio({
      calle: '',
      numExterior: '',
      numInterior: '',
      colonia: '',
      codigoPostal: '',
      municipio: '',
      estado: '',
      domicilioCompleto: '',
    });
    setObligadoDomicilioOcrLoading(false);
    setObligadoDomicilioOcrError(null);
    setObligadoDomicilioOcrSuccess(null);
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
    setRequiereObligadoSolidario(false);
    setObligadoNombre('');
    setObligadoCurp('');
    setObligadoRfc('');
    setObligadoFechaNacimiento('');
    setObligadoSexo('');
    setObligadoTelefono('');
    setObligadoCorreo('');
    setObligadoIngresoMensual('');
    setObligadoTiempoViviendoDomicilio('');
    setObligadoCasaPropiaORentada('');
    setObligadoTiempoEnTrabajo('');
    setObligadoNombreUbicacionEmpleo('');
    setObligadoDireccionEmpleo('');
    setObligadoGiroActividadEmpresa('');
    setObligadoDependientesEconomicos(0);
    setObligadoEstadoCivil('');
    setObligadoReferencias([
      { nombre: '', telefono: '', relacion: 'Familiar (otro domicilio)', esFamiliar: true },
      { nombre: '', telefono: '', relacion: 'Conocido 1', esFamiliar: false },
      { nombre: '', telefono: '', relacion: 'Conocido 2', esFamiliar: false },
    ]);
    setObligadoIneFrente(null);
    setObligadoIneFrenteNombre('');
    setObligadoIneReverso(null);
    setObligadoIneReversoNombre('');
    setObligadoComprobante(null);
    setObligadoComprobanteNombre('');
    setObligadoMes1(null);
    setObligadoMes1Nombre('');
    setObligadoMes2(null);
    setObligadoMes2Nombre('');
    setObligadoMes3(null);
    setObligadoMes3Nombre('');
    setObligadoConsolidado(null);
    setObligadoConsolidadoNombre('');
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
        <div className="bg-[#1C2541] border border-[#2E3A59] rounded-3xl p-6 sm:p-10 shadow-lg text-slate-200 relative overflow-hidden">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-5 border border-emerald-200">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-center text-slate-100 mb-2">
            ¡Expediente Guardado y Enviado al Asesor!
          </h2>
          <p className="text-center text-slate-400 text-sm max-w-xl mx-auto mb-8">
            La información del cliente, su identificación INE, comprobante de domicilio y estados de cuenta bancarios han sido guardados con seguridad en la base de datos de CrediMóvil.
          </p>

          <div className="bg-[#121824] border border-[#2E3A59] rounded-2xl p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <p className="text-2xl font-mono font-black text-slate-100">
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
                <p className="text-xl font-mono font-bold text-slate-200">
                  {savedExpediente.ine?.rfc || (savedExpediente.ine?.curp ? savedExpediente.ine.curp.substring(0, 10) : 'N/A')}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 truncate">
                  {savedExpediente.ine?.nombreCompleto || savedExpediente.ine?.nombre}
                </p>
              </div>
            </div>

            <div className="border-t border-[#2E3A59] mt-5 pt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Vehículo:</span>
                <strong className="text-slate-100 font-semibold">
                  {savedExpediente.autoMarca} {savedExpediente.autoModelo} ({savedExpediente.autoAno})
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Lote Aliado:</span>
                <strong className="text-slate-100 font-semibold">{savedExpediente.loteNombre}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Monto Financiado:</span>
                <strong className="text-emerald-700 font-bold">
                  ${savedExpediente.montoFinanciar?.toLocaleString('es-MX')} MXN
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Documentación:</span>
                <span className="text-slate-100 font-bold">
                  {docsCompletadosCount} de 3 adjuntos
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <button
              onClick={openWhatsAppShare}
              className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              Notificar al Lote por WhatsApp
            </button>

            <button
              onClick={copyShareLink}
              className="py-3 px-4 bg-[#1C2541] hover:bg-[#121824] text-slate-300 border border-[#3A4868] font-semibold rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copiedLink ? '¡Enlace Copiado!' : 'Copiar Enlace Directo'}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#2E3A59]">
            <button
              onClick={() => onGoToFondeo(savedExpediente.folio)}
              className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <FileCheck className="w-4 h-4 text-amber-400" />
              Ver Checklist de Documentación y Fondeo
            </button>

            <button
              onClick={resetForm}
              className="py-3 px-5 bg-[#1C2541] hover:bg-[#121824] text-slate-300 border border-[#3A4868] rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer"
            >
              Capturar Nueva Solicitud
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="credimovil-mobile-form max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-5 sm:py-8 space-y-5 sm:space-y-8">
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
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" /> 3. Estados de Cuenta (3M) — OPCIONAL
                </span>
                {hasEstadosCuenta ? (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> Estados opcionales listos
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-500">Pendiente</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Opcional: individuales mes 1, 2 y 3 o 1 archivo PDF consolidado. Se pueden agregar después.
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
        <div className="bg-[#1C2541] border-2 border-[#2E3A59] rounded-2xl shadow-xs overflow-hidden">
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
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
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
                <div className="border border-[#2E3A59] rounded-2xl p-4 bg-[#121824]/60 hover:border-[#3A4868] transition space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">
                      Frente del INE <span className="text-red-500">*</span>
                    </span>
                    {fotoFrente && (
                      <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Cargado
                      </span>
                    )}
                  </div>

                  <div className="aspect-16/10 rounded-xl bg-[#1C2541] border border-[#2E3A59] overflow-hidden flex flex-col items-center justify-center relative group">
                    {fotoFrente ? (
                      <>
                        {fotoFrente.startsWith('data:application/pdf') ? (
                          <div className="p-4 text-center">
                            <FileText className="w-10 h-10 text-red-600 mx-auto mb-1" />
                            <span className="text-xs font-bold text-slate-300 block truncate max-w-[200px]">
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
                            className="p-2 bg-[#1C2541] text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
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
                        <p className="text-xs font-medium text-slate-400">
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
                      className="flex-1 py-2 px-3 bg-[#1C2541] hover:bg-[#18223A] text-slate-300 border border-[#3A4868] rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
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
                <div className="border border-[#2E3A59] rounded-2xl p-4 bg-[#121824]/60 hover:border-[#3A4868] transition space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">
                      Reverso del INE (Firma y Código) <span className="text-red-500">*</span>
                    </span>
                    {fotoReverso && (
                      <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Cargado
                      </span>
                    )}
                  </div>

                  <div className="aspect-16/10 rounded-xl bg-[#1C2541] border border-[#2E3A59] overflow-hidden flex flex-col items-center justify-center relative group">
                    {fotoReverso ? (
                      <>
                        {fotoReverso.startsWith('data:application/pdf') ? (
                          <div className="p-4 text-center">
                            <FileText className="w-10 h-10 text-red-600 mx-auto mb-1" />
                            <span className="text-xs font-bold text-slate-300 block truncate max-w-[200px]">
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
                            className="p-2 bg-[#1C2541] text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
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
                        <p className="text-xs font-medium text-slate-400">
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
                      className="flex-1 py-2 px-3 bg-[#1C2541] hover:bg-[#18223A] text-slate-300 border border-[#3A4868] rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
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
                <div className="p-4 rounded-xl bg-[#18223A] border border-[#2E3A59] flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-5 h-5 text-red-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-100">
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

            <hr className="border-[#2E3A59]" />

            {/* SUB-SECCIÓN 1.2: COMPROBANTE DE DOMICILIO (AGUA O LUZ CFE) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDomicilioCoincideConIne(true)}
                  className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 cursor-pointer ${
                    domicilioCoincideConIne
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-[#1C2541] border-[#2E3A59] text-slate-300 hover:bg-[#121824]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      domicilioCoincideConIne ? 'border-white bg-[#1C2541] text-slate-100' : 'border-slate-400'
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
                      : 'bg-[#1C2541] border-[#2E3A59] text-slate-300 hover:bg-[#121824]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      !domicilioCoincideConIne ? 'border-white bg-[#1C2541] text-slate-100' : 'border-slate-400'
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
              <div className="border border-[#2E3A59] rounded-2xl p-4 bg-[#121824]/60 space-y-3">
                {comprobanteDomicilioDoc ? (
                  <div className="p-3 bg-[#1C2541] border border-[#2E3A59] rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-slate-100 truncate max-w-[260px]">
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
                        className="py-1.5 px-2.5 bg-[#1C2541] hover:bg-[#18223A] border border-[#3A4868] text-slate-300 rounded-lg text-xs font-medium cursor-pointer"
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
                        className="py-1.5 px-2.5 bg-[#1C2541] hover:bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-xs font-medium cursor-pointer"
                        title="Quitar comprobante"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 border-2 border-dashed border-[#3A4868] rounded-xl bg-[#1C2541] text-center space-y-2">
                    <FileText className="w-7 h-7 text-slate-400 mx-auto" />
                    <div>
                      <p className="text-xs font-bold text-slate-200">
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
                        className="py-1.5 px-3 bg-[#1C2541] hover:bg-[#18223A] text-slate-300 border border-[#3A4868] rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
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

            <hr className="border-[#2E3A59]" />

            {/* SUB-SECCIÓN 1.3: ESTADOS DE CUENTA BANCARIOS (3 MESES) */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
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
              <div className="flex items-center gap-2 p-1 bg-[#18223A] rounded-xl max-w-md">
                <button
                  type="button"
                  onClick={() => setModoEstadosCuenta('individual')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                    modoEstadosCuenta === 'individual'
                      ? 'bg-[#1C2541] text-slate-100 shadow-xs'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  3 Meses Individuales
                </button>
                <button
                  type="button"
                  onClick={() => setModoEstadosCuenta('consolidado')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                    modoEstadosCuenta === 'consolidado'
                      ? 'bg-[#1C2541] text-slate-100 shadow-xs'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  1 Archivo PDF Consolidado
                </button>
              </div>

              {/* Opción A: 3 Meses Separados */}
              {modoEstadosCuenta === 'individual' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Mes 1 */}
                  <div className="border border-[#2E3A59] rounded-2xl p-4 bg-[#121824]/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">
                        Mes 1 (Más reciente)
                      </span>
                      {mes1Doc && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    {mes1Doc ? (
                      <div className="p-3 bg-[#1C2541] border border-[#2E3A59] rounded-xl space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-red-600 shrink-0" />
                          <p className="text-xs font-semibold text-slate-200 truncate">
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
                            className="flex-1 py-1 bg-[#18223A] hover:bg-[#222D47] text-slate-300 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer"
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
                        className="w-full py-4 border-2 border-dashed border-[#3A4868] rounded-xl bg-[#1C2541] hover:bg-[#121824] text-center space-y-1 transition cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-slate-400 mx-auto" />
                        <span className="text-xs font-bold text-slate-300 block">Subir Mes 1</span>
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
                  <div className="border border-[#2E3A59] rounded-2xl p-4 bg-[#121824]/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">
                        Mes 2 (Anterior)
                      </span>
                      {mes2Doc && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    {mes2Doc ? (
                      <div className="p-3 bg-[#1C2541] border border-[#2E3A59] rounded-xl space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-red-600 shrink-0" />
                          <p className="text-xs font-semibold text-slate-200 truncate">
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
                            className="flex-1 py-1 bg-[#18223A] hover:bg-[#222D47] text-slate-300 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer"
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
                        className="w-full py-4 border-2 border-dashed border-[#3A4868] rounded-xl bg-[#1C2541] hover:bg-[#121824] text-center space-y-1 transition cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-slate-400 mx-auto" />
                        <span className="text-xs font-bold text-slate-300 block">Subir Mes 2</span>
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
                  <div className="border border-[#2E3A59] rounded-2xl p-4 bg-[#121824]/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">
                        Mes 3 (Hace 3 meses)
                      </span>
                      {mes3Doc && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    {mes3Doc ? (
                      <div className="p-3 bg-[#1C2541] border border-[#2E3A59] rounded-xl space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-red-600 shrink-0" />
                          <p className="text-xs font-semibold text-slate-200 truncate">
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
                            className="flex-1 py-1 bg-[#18223A] hover:bg-[#222D47] text-slate-300 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer"
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
                        className="w-full py-4 border-2 border-dashed border-[#3A4868] rounded-xl bg-[#1C2541] hover:bg-[#121824] text-center space-y-1 transition cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-slate-400 mx-auto" />
                        <span className="text-xs font-bold text-slate-300 block">Subir Mes 3</span>
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
                <div className="border border-[#2E3A59] rounded-2xl p-4 bg-[#121824]/60">
                  {consolidadoDoc ? (
                    <div className="p-3 bg-[#1C2541] border border-[#2E3A59] rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="w-6 h-6 text-red-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-slate-100 truncate">
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
                          className="py-1.5 px-3 bg-[#18223A] hover:bg-[#222D47] text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
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
                      className="w-full py-6 border-2 border-dashed border-[#3A4868] rounded-xl bg-[#1C2541] hover:bg-[#121824] text-center space-y-1 transition cursor-pointer"
                    >
                      <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                      <span className="text-xs font-bold text-slate-200 block">
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
        {/* SECCIÓN 2: DATOS DEL CLIENTE */}
        {/* ======================================================== */}
        <div className="bg-[#1C2541] border border-[#2E3A59] rounded-2xl shadow-sm p-5 sm:p-7 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-[#2E3A59]">
            <span className="w-7 h-7 rounded-md bg-red-600 text-white text-xs font-black flex items-center justify-center">2</span>
            <div>
              <h3 className="text-base font-black text-slate-100">Datos del Cliente</h3>
              <p className="text-xs text-slate-500">Información obtenida de la INE y domicilio validado.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Nombre(s) <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={ineData.nombre || ''}
                onChange={(e) => setIneData((prev) => {
                  const next = { ...prev, nombre: e.target.value };
                  next.nombreCompleto = [next.nombre, next.primerApellido, next.segundoApellido].filter(Boolean).join(' ');
                  return next;
                })}
                placeholder="Nombre(s)"
                className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Primer apellido <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={ineData.primerApellido || ''}
                onChange={(e) => setIneData((prev) => {
                  const next = { ...prev, primerApellido: e.target.value };
                  next.nombreCompleto = [next.nombre, next.primerApellido, next.segundoApellido].filter(Boolean).join(' ');
                  return next;
                })}
                placeholder="Apellido paterno"
                className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Segundo apellido</label>
              <input
                type="text"
                value={ineData.segundoApellido || ''}
                onChange={(e) => setIneData((prev) => {
                  const next = { ...prev, segundoApellido: e.target.value };
                  next.nombreCompleto = [next.nombre, next.primerApellido, next.segundoApellido].filter(Boolean).join(' ');
                  return next;
                })}
                placeholder="Apellido materno"
                className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">CURP (18 dígitos) <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                maxLength={18}
                value={ineData.curp || ''}
                onChange={(e) => setIneData((prev) => ({ ...prev, curp: e.target.value.toUpperCase() }))}
                placeholder="CURP"
                className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm font-mono uppercase focus:border-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                RFC del Cliente <span className="text-red-500">*</span>
                <span className="ml-2 text-[10px] font-semibold text-red-600 normal-case">Auto-generar</span>
              </label>
              <input
                type="text"
                maxLength={13}
                value={ineData.rfc || ''}
                onChange={(e) => setIneData((prev) => ({ ...prev, rfc: e.target.value.toUpperCase() }))}
                placeholder="RFC"
                className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm font-mono uppercase focus:border-red-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500 mt-1">Se genera con la base del CURP y puede completarse con homoclave SAT.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Fecha de nacimiento <span className="text-red-500">*</span></label>
              <input
                type="date"
                required
                value={ineData.fechaNacimiento || ''}
                onChange={(e) => setIneData((prev) => ({ ...prev, fechaNacimiento: e.target.value }))}
                className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Sexo <span className="text-red-500">*</span></label>
              <select
                required
                value={ineData.sexo || ''}
                onChange={(e) => setIneData((prev) => ({ ...prev, sexo: e.target.value }))}
                className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none"
              >
                <option value="">Seleccionar...</option>
                <option value="H">Hombre</option>
                <option value="M">Mujer</option>
              </select>
            </div>

            <div className="lg:col-span-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">Domicilio actual</label>
                  <p className="text-[10px] text-slate-500 mt-1">El OCR lo separa automáticamente y puedes corregir cada campo.</p>
                </div>
                <MapPin className="w-4 h-4 text-red-600 shrink-0" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="lg:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Calle</label>
                  <input
                    type="text"
                    value={ineData.domicilio?.calle || ''}
                    onChange={(e) => updateDomicilioField('calle', e.target.value)}
                    placeholder="Calle"
                    className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. exterior</label>
                  <input
                    type="text"
                    value={ineData.domicilio?.numExterior || ''}
                    onChange={(e) => updateDomicilioField('numExterior', e.target.value)}
                    placeholder="No."
                    className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. interior</label>
                  <input
                    type="text"
                    value={ineData.domicilio?.numInterior || ''}
                    onChange={(e) => updateDomicilioField('numInterior', e.target.value)}
                    placeholder="Int."
                    className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none"
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Colonia</label>
                  <input
                    type="text"
                    value={ineData.domicilio?.colonia || ''}
                    onChange={(e) => updateDomicilioField('colonia', e.target.value)}
                    placeholder="Colonia / fraccionamiento"
                    className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Código postal</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={ineData.domicilio?.codigoPostal || ''}
                    onChange={(e) => updateDomicilioField('codigoPostal', e.target.value.replace(/\D/g, '').slice(0, 5))}
                    placeholder="C.P."
                    className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Municipio / Alcaldía</label>
                  <input
                    type="text"
                    value={ineData.domicilio?.municipio || ''}
                    onChange={(e) => updateDomicilioField('municipio', e.target.value)}
                    placeholder="Municipio"
                    className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Estado</label>
                  <input
                    type="text"
                    value={ineData.domicilio?.estado || ''}
                    onChange={(e) => updateDomicilioField('estado', e.target.value)}
                    placeholder="Estado"
                    className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECCIÓN 3: PERFIL SOCIOECONÓMICO Y LABORAL */}
        {/* ======================================================== */}
        <div className="bg-[#1C2541] border border-[#2E3A59] rounded-2xl shadow-sm p-5 sm:p-7 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-[#2E3A59]">
            <span className="w-7 h-7 rounded-md bg-red-600 text-white text-xs font-black flex items-center justify-center">3</span>
            <div>
              <h3 className="text-base font-black text-slate-100">Perfil Socioeconómico y Laboral</h3>
              <p className="text-xs text-slate-500">Información de contacto, empleo y referencias personales para el dictamen.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Teléfono de contacto <span className="text-red-500">*</span></label>
              <input type="tel" required value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="81 1234 5678" className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Correo electrónico</label>
              <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="cliente@ejemplo.com" className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Ingreso mensual comprobable ($MXN) <span className="text-red-500">*</span></label>
              <input type="number" min="0" required value={ingresoMensual} onChange={(e) => setIngresoMensual(e.target.value === '' ? '' : Number(e.target.value))} placeholder="ej. 35000" className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Vivienda <span className="text-red-500">*</span></label>
              <select required value={casaPropiaORentada} onChange={(e) => setCasaPropiaORentada(e.target.value as any)} className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none">
                <option value="">Seleccionar condición...</option>
                <option value="PROPIA">Casa propia</option>
                <option value="RENTADA">Rentada</option>
                <option value="FAMILIAR">Casa familiar</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Antigüedad en domicilio <span className="text-red-500">*</span></label>
              <input type="text" required value={tiempoViviendoDomicilio} onChange={(e) => setTiempoViviendoDomicilio(e.target.value)} placeholder="ej. 5 años" className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Empresa / lugar de trabajo <span className="text-red-500">*</span></label>
              <input type="text" required value={nombreUbicacionEmpleo} onChange={(e) => setNombreUbicacionEmpleo(e.target.value)} placeholder="ej. Nemak México" className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Antigüedad en empleo <span className="text-red-500">*</span></label>
              <input type="text" required value={tiempoEnTrabajo} onChange={(e) => setTiempoEnTrabajo(e.target.value)} placeholder="ej. 3 años" className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Dependientes económicos</label>
              <input type="number" min="0" value={dependientesEconomicos} onChange={(e) => setDependientesEconomicos(Number(e.target.value) || 0)} className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none" />
            </div>
            <div className="lg:col-span-3">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Dirección del empleo <span className="text-red-500">*</span></label>
              <input type="text" required value={direccionEmpleo} onChange={(e) => setDireccionEmpleo(e.target.value)} placeholder="Calle, número, colonia, municipio, estado" className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Estado civil <span className="text-red-500">*</span></label>
              <select required value={estadoCivil} onChange={(e) => setEstadoCivil(e.target.value as any)} className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none">
                <option value="">Seleccionar...</option>
                <option value="SOLTERO">Soltero(a)</option>
                <option value="CASADO">Casado(a)</option>
                <option value="UNION_LIBRE">Unión libre</option>
                <option value="DIVORCIADO">Divorciado(a)</option>
                <option value="VIUDO">Viudo(a)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-[#2E3A59]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h4 className="text-sm font-black text-slate-100 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-red-600" />
                  Comprobantes de nómina <span className="text-[10px] font-bold text-slate-500 uppercase">(Opcional)</span>
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Puedes adjuntar hasta 3 recibos recientes de nómina para fortalecer el expediente. No se realiza OCR todavía.
                </p>
              </div>
              <span className="text-[11px] font-bold text-slate-400">{nominas.length}/3 cargados</span>
            </div>

            {nominas.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                {nominas.map((doc, index) => (
                  <div key={index} className="rounded-xl border border-[#2E3A59] bg-[#121824] p-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-red-400 shrink-0" />
                      <p className="text-xs font-semibold text-slate-200 truncate">{doc.archivoNombre || `Nómina ${index + 1}`}</p>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Nómina {index + 1} · {doc.archivoTamano ? (doc.archivoTamano / 1024 / 1024).toFixed(2) + ' MB' : 'Archivo adjunto'}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewModalUrl(doc.archivoUrl);
                          setPreviewModalTitle(`Comprobante de nómina ${index + 1}`);
                        }}
                        className="flex-1 py-1.5 bg-[#1C2541] border border-[#3A4868] text-slate-300 rounded-lg text-[11px] font-semibold"
                      >
                        <Eye className="w-3 h-3 inline mr-1" /> Ver
                      </button>
                      <button
                        type="button"
                        onClick={() => setNominas((prev) => prev.filter((_, i) => i !== index))}
                        className="py-1.5 px-2.5 bg-[#1C2541] border border-rose-200 text-rose-500 rounded-lg text-[11px] font-semibold"
                      >
                        <Trash2 className="w-3 h-3 inline" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {nominas.length < 3 && (
              <>
                <button
                  type="button"
                  onClick={() => nominaInputRef.current?.click()}
                  className="w-full py-4 border-2 border-dashed border-[#3A4868] rounded-xl bg-[#121824] hover:bg-[#18223A] text-center transition"
                >
                  <Upload className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                  <span className="text-xs font-bold text-slate-300 block">Subir nóminas</span>
                  <span className="text-[10px] text-slate-500 block">PDF, PNG, JPG o WEBP · Máx. 10 MB por archivo</span>
                </button>
                <input
                  ref={nominaInputRef}
                  type="file"
                  multiple
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleNominaFiles}
                />
              </>
            )}
          </div>

          <div className="pt-2">
            <h4 className="text-sm font-black text-slate-100 mb-3">Referencias personales</h4>
            <p className="text-xs text-slate-500 mb-3">1 familiar que viva en otro domicilio y 2 conocidos.</p>
            <div className="space-y-3">
              {referencias.map((ref, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-2xl bg-[#121824] border border-[#2E3A59]">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      {index === 0 ? 'Familiar (otro domicilio)' : `Conocido ${index}`}
                    </label>
                    <input type="text" required value={ref.nombre} onChange={(e) => setReferencias((prev) => prev.map((item, i) => i === index ? { ...item, nombre: e.target.value } : item))} placeholder="Nombre completo" className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Teléfono</label>
                    <input type="tel" required value={ref.telefono} onChange={(e) => setReferencias((prev) => prev.map((item, i) => i === index ? { ...item, telefono: e.target.value } : item))} placeholder="81 1234 5678" className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-red-500 focus:outline-none" />
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs text-slate-500 font-semibold">{index === 0 ? 'Debe vivir en otro domicilio' : 'Conocido'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SECCIÓN 4: DATOS DEL VEHÍCULO Y LOTE ASOCIADO           */}
        {/* ======================================================== */}
        <div className="bg-[#1C2541] border border-[#2E3A59] rounded-2xl shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-[#2E3A59]">
            <span className="w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-black flex items-center justify-center">
              4
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Unidad a Financiar y Lote de Autos
              </h3>
              <p className="text-xs text-slate-500">
                Términos del vehículo y vinculación directa con el lote aliado sin intermediarios
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Lote Aliado Asociado <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedLoteId}
                onChange={(e) => setSelectedLoteId(e.target.value)}
                className="w-full py-2 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-slate-900 focus:outline-none"
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
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Marca del Auto <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={autoMarca}
                onChange={(e) => setAutoMarca(e.target.value)}
                placeholder="ej. Mazda, Honda, Nissan"
                className="w-full py-2 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Modelo / Versión <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={autoModelo}
                onChange={(e) => setAutoModelo(e.target.value)}
                placeholder="ej. Mazda 3 i Grand Touring"
                className="w-full py-2 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Año / Modelo
              </label>
              <input
                type="number"
                value={autoAno}
                onChange={(e) => setAutoAno(Number(e.target.value))}
                className="w-full py-2 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Precio de Venta ($MXN) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                value={autoPrecio}
                onChange={(e) => setAutoPrecio(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="ej. 320000"
                className="w-full py-2 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-slate-900 focus:outline-none font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
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
                      : 'bg-[#1C2541] text-slate-400 border-[#3A4868]'
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
                      : 'bg-[#1C2541] text-slate-400 border-[#3A4868]'
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
                    className="w-full py-2 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm font-semibold focus:border-slate-900 focus:outline-none"
                  />
                  <div className="py-2 px-3 bg-[#18223A] border border-[#3A4868] rounded-xl text-slate-300 text-sm font-bold">
                    %
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="py-2 px-3 bg-[#18223A] border border-[#3A4868] rounded-xl text-slate-300 text-sm font-bold">
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
                    className="w-full py-2 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm font-semibold focus:border-slate-900 focus:outline-none"
                  />
                </div>
              )}

              <p className="text-[10px] text-slate-500 mt-1">
                En efectivo: monto libre • Equivalente informativo: {calcEnganchePorcentajeReal}% del valor
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Plazo (Meses)
              </label>
              <select
                value={plazoMeses}
                onChange={(e) => setPlazoMeses(Number(e.target.value))}
                className="w-full py-2 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-slate-900 focus:outline-none"
              >
                <option value={12}>12 Meses (1 Año)</option>
                <option value={24}>24 Meses (2 Años)</option>
                <option value={36}>36 Meses (3 Años)</option>
                <option value={48}>48 Meses (4 Años)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Monto a Financiar
              </label>
              <div className="py-2 px-3 bg-[#18223A] border border-[#3A4868] rounded-xl text-emerald-800 text-sm font-bold">
                ${calcMontoFinanciar.toLocaleString('es-MX')} MXN
              </div>
            </div>
          </div>

          {/* Legalizado switch */}
          <div className="p-3.5 bg-[#121824] border border-[#2E3A59] rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-200 block">
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
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#1C2541] after:border-[#3A4868] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>
        </div>

        {/* ======================================================== */}
        {/* OBLIGADO SOLIDARIO - AL FINAL DEL EXPEDIENTE */}
        {/* ======================================================== */}
        <div className="bg-[#1C2541] border-2 border-amber-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-5 sm:px-6 py-5 bg-amber-50 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-black text-slate-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600" />
                Obligado Solidario
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Actívalo solo cuando la financiera lo solicite. Al activarlo, se deberán capturar los mismos datos y documentación del titular.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {requiereObligadoSolidario && obligadoIneFrente && (
                <button
                  type="button"
                  onClick={handleRunObligadoOcr}
                  disabled={isScanningObligado}
                  className="py-2 px-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-[11px] font-black flex items-center gap-1.5"
                  title="Extraer nombre, CURP, RFC, fecha y sexo desde el INE"
                >
                  {isScanningObligado ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Scan className="w-3.5 h-3.5" />}
                  {isScanningObligado ? 'Leyendo INE...' : 'OCR del obligado'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setRequiereObligadoSolidario((value) => !value)}
                className={`relative w-14 h-7 rounded-full transition ${requiereObligadoSolidario ? 'bg-amber-500' : 'bg-slate-300'}`}
                aria-pressed={requiereObligadoSolidario}
              >
                <span className={`absolute top-1 w-5 h-5 rounded-full bg-[#1C2541] shadow transition ${requiereObligadoSolidario ? 'left-8' : 'left-1'}`} />
              </button>
            </div>
          </div>

          {requiereObligadoSolidario && (
            <div className="p-5 sm:p-8 space-y-7">
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200">
                <p className="text-xs font-bold text-slate-100">Captura del obligado solidario</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Debe llenarse igual que el titular: contacto, ingresos, vivienda, empleo, referencias y documentación.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-black text-slate-100 mb-3">1. Datos de identificación y contacto</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Nombre completo <span className="text-red-500">*</span></label>
                    <input type="text" required value={obligadoNombre} onChange={(e) => setObligadoNombre(e.target.value)} placeholder="Nombre completo" className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">CURP <span className="text-red-500">*</span></label>
                    <input type="text" required value={obligadoCurp} onChange={(e) => setObligadoCurp(e.target.value.toUpperCase())} placeholder="18 caracteres" maxLength={18} className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm uppercase focus:border-amber-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">RFC <span className="text-red-500">*</span></label>
                    <input type="text" required value={obligadoRfc} onChange={(e) => setObligadoRfc(e.target.value.toUpperCase())} placeholder="RFC" maxLength={13} className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm uppercase focus:border-amber-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Fecha de nacimiento <span className="text-red-500">*</span></label>
                    <input type="date" required value={obligadoFechaNacimiento} onChange={(e) => setObligadoFechaNacimiento(e.target.value)} className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Sexo <span className="text-red-500">*</span></label>
                    <select required value={obligadoSexo} onChange={(e) => setObligadoSexo(e.target.value)} className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none">
                      <option value="">Seleccionar...</option>
                      <option value="H">Hombre</option>
                      <option value="M">Mujer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Teléfono <span className="text-red-500">*</span></label>
                    <input type="tel" required value={obligadoTelefono} onChange={(e) => setObligadoTelefono(e.target.value)} placeholder="81 1234 5678" className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Correo electrónico</label>
                    <input type="email" value={obligadoCorreo} onChange={(e) => setObligadoCorreo(e.target.value)} placeholder="correo@ejemplo.com" className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Estado civil <span className="text-red-500">*</span></label>
                    <select required value={obligadoEstadoCivil} onChange={(e) => setObligadoEstadoCivil(e.target.value as any)} className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none">
                      <option value="">Seleccionar...</option>
                      <option value="SOLTERO">Soltero(a)</option>
                      <option value="CASADO">Casado(a)</option>
                      <option value="UNION_LIBRE">Unión libre</option>
                      <option value="DIVORCIADO">Divorciado(a)</option>
                      <option value="VIUDO">Viudo(a)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Nombre completo <span className="text-red-500">*</span></label>
                    <input type="text" required value={obligadoNombre} onChange={(e) => setObligadoNombre(e.target.value)} placeholder="Nombre completo" className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Teléfono <span className="text-red-500">*</span></label>
                    <input type="tel" required value={obligadoTelefono} onChange={(e) => setObligadoTelefono(e.target.value)} placeholder="81 1234 5678" className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Correo electrónico</label>
                    <input type="email" value={obligadoCorreo} onChange={(e) => setObligadoCorreo(e.target.value)} placeholder="correo@ejemplo.com" className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Estado civil <span className="text-red-500">*</span></label>
                    <select required value={obligadoEstadoCivil} onChange={(e) => setObligadoEstadoCivil(e.target.value as any)} className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none">
                      <option value="">Seleccionar...</option>
                      <option value="SOLTERO">Soltero(a)</option>
                      <option value="CASADO">Casado(a)</option>
                      <option value="UNION_LIBRE">Unión libre</option>
                      <option value="DIVORCIADO">Divorciado(a)</option>
                      <option value="VIUDO">Viudo(a)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black text-slate-100 mb-3">2. Perfil socioeconómico y laboral</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Ingreso mensual comprobable <span className="text-red-500">*</span></label>
                    <input type="number" required min="0" value={obligadoIngresoMensual} onChange={(e) => setObligadoIngresoMensual(e.target.value === '' ? '' : Number(e.target.value))} placeholder="ej. 35000" className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Vivienda <span className="text-red-500">*</span></label>
                    <select required value={obligadoCasaPropiaORentada} onChange={(e) => setObligadoCasaPropiaORentada(e.target.value as any)} className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none">
                      <option value="">Seleccionar condición...</option>
                      <option value="PROPIA">Casa propia</option>
                      <option value="RENTADA">Rentada</option>
                      <option value="FAMILIAR">Casa familiar</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Antigüedad en domicilio <span className="text-red-500">*</span></label>
                    <input type="text" required value={obligadoTiempoViviendoDomicilio} onChange={(e) => setObligadoTiempoViviendoDomicilio(e.target.value)} placeholder="ej. 5 años" className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Empresa / lugar de trabajo <span className="text-red-500">*</span></label>
                    <input type="text" required value={obligadoNombreUbicacionEmpleo} onChange={(e) => setObligadoNombreUbicacionEmpleo(e.target.value)} placeholder="ej. Empresa XYZ" className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Antigüedad en empleo <span className="text-red-500">*</span></label>
                    <input type="text" required value={obligadoTiempoEnTrabajo} onChange={(e) => setObligadoTiempoEnTrabajo(e.target.value)} placeholder="ej. 3 años" className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Dependientes económicos</label>
                    <input type="number" min="0" value={obligadoDependientesEconomicos} onChange={(e) => setObligadoDependientesEconomicos(Number(e.target.value) || 0)} className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Dirección del empleo <span className="text-red-500">*</span></label>
                    <input type="text" required value={obligadoDireccionEmpleo} onChange={(e) => setObligadoDireccionEmpleo(e.target.value)} placeholder="Calle, número, colonia, municipio, estado" className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none" />
                  </div>
                </div>

                {/* Domicilio actual del obligado: se puede completar automáticamente con el OCR del comprobante */}
                <div className="mt-5 pt-5 border-t border-[#2E3A59]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div>
                      <h4 className="text-xs font-black text-slate-100 uppercase tracking-wider">Dirección de vivienda</h4>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Puedes capturarla manualmente o usar el OCR del comprobante de domicilio.
                      </p>
                    </div>
                    {obligadoComprobante && (
                      <button
                        type="button"
                        onClick={handleRunObligadoComprobanteOcr}
                        disabled={obligadoDomicilioOcrLoading}
                        className="py-2 px-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-[11px] font-black flex items-center gap-1.5"
                      >
                        {obligadoDomicilioOcrLoading ? (
                          <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Leyendo domicilio...</>
                        ) : (
                          <><Scan className="w-3.5 h-3.5" /> Llenar con OCR</>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="lg:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Calle</label>
                      <input
                        type="text"
                        value={obligadoDomicilio.calle}
                        onChange={(e) => setObligadoDomicilio((prev) => ({ ...prev, calle: e.target.value, domicilioCompleto: [e.target.value, prev.numExterior ? `#${prev.numExterior}` : '', prev.numInterior ? `Int. ${prev.numInterior}` : '', prev.colonia ? `Col. ${prev.colonia}` : '', prev.codigoPostal ? `C.P. ${prev.codigoPostal}` : '', prev.municipio, prev.estado].filter(Boolean).join(', ') }))}
                        placeholder="Calle"
                        className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. exterior</label>
                      <input
                        type="text"
                        value={obligadoDomicilio.numExterior}
                        onChange={(e) => setObligadoDomicilio((prev) => ({ ...prev, numExterior: e.target.value, domicilioCompleto: [prev.calle, e.target.value ? `#${e.target.value}` : '', prev.numInterior ? `Int. ${prev.numInterior}` : '', prev.colonia ? `Col. ${prev.colonia}` : '', prev.codigoPostal ? `C.P. ${prev.codigoPostal}` : '', prev.municipio, prev.estado].filter(Boolean).join(', ') }))}
                        placeholder="No."
                        className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. interior</label>
                      <input
                        type="text"
                        value={obligadoDomicilio.numInterior}
                        onChange={(e) => setObligadoDomicilio((prev) => ({ ...prev, numInterior: e.target.value, domicilioCompleto: [prev.calle, prev.numExterior ? `#${prev.numExterior}` : '', e.target.value ? `Int. ${e.target.value}` : '', prev.colonia ? `Col. ${prev.colonia}` : '', prev.codigoPostal ? `C.P. ${prev.codigoPostal}` : '', prev.municipio, prev.estado].filter(Boolean).join(', ') }))}
                        placeholder="Int."
                        className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Colonia</label>
                      <input
                        type="text"
                        value={obligadoDomicilio.colonia}
                        onChange={(e) => setObligadoDomicilio((prev) => ({ ...prev, colonia: e.target.value, domicilioCompleto: [prev.calle, prev.numExterior ? `#${prev.numExterior}` : '', prev.numInterior ? `Int. ${prev.numInterior}` : '', e.target.value ? `Col. ${e.target.value}` : '', prev.codigoPostal ? `C.P. ${prev.codigoPostal}` : '', prev.municipio, prev.estado].filter(Boolean).join(', ') }))}
                        placeholder="Colonia / fraccionamiento"
                        className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Código postal</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={5}
                        value={obligadoDomicilio.codigoPostal}
                        onChange={(e) => setObligadoDomicilio((prev) => ({ ...prev, codigoPostal: e.target.value.replace(/\D/g, '').slice(0, 5), domicilioCompleto: [prev.calle, prev.numExterior ? `#${prev.numExterior}` : '', prev.numInterior ? `Int. ${prev.numInterior}` : '', prev.colonia ? `Col. ${prev.colonia}` : '', e.target.value ? `C.P. ${e.target.value.replace(/\D/g, '').slice(0, 5)}` : '', prev.municipio, prev.estado].filter(Boolean).join(', ') }))}
                        placeholder="C.P."
                        className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Municipio / Alcaldía</label>
                      <input
                        type="text"
                        value={obligadoDomicilio.municipio}
                        onChange={(e) => setObligadoDomicilio((prev) => ({ ...prev, municipio: e.target.value, domicilioCompleto: [prev.calle, prev.numExterior ? `#${prev.numExterior}` : '', prev.numInterior ? `Int. ${prev.numInterior}` : '', prev.colonia ? `Col. ${prev.colonia}` : '', prev.codigoPostal ? `C.P. ${prev.codigoPostal}` : '', e.target.value, prev.estado].filter(Boolean).join(', ') }))}
                        placeholder="Municipio"
                        className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Estado</label>
                      <input
                        type="text"
                        value={obligadoDomicilio.estado}
                        onChange={(e) => setObligadoDomicilio((prev) => ({ ...prev, estado: e.target.value, domicilioCompleto: [prev.calle, prev.numExterior ? `#${prev.numExterior}` : '', prev.numInterior ? `Int. ${prev.numInterior}` : '', prev.colonia ? `Col. ${prev.colonia}` : '', prev.codigoPostal ? `C.P. ${prev.codigoPostal}` : '', prev.municipio, e.target.value].filter(Boolean).join(', ') }))}
                        placeholder="Estado"
                        className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {obligadoDomicilio.domicilioCompleto && (
                    <div className="mt-3 rounded-xl bg-[#121824] border border-[#2E3A59] p-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Domicilio completo</p>
                      <p className="text-xs text-slate-200">{obligadoDomicilio.domicilioCompleto}</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black text-slate-100 mb-3">3. Referencias personales</h3>
                <div className="space-y-3">
                  {obligadoReferencias.map((ref, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-2xl bg-[#121824] border border-[#2E3A59]">
                      <input type="text" required value={ref.nombre} onChange={(e) => setObligadoReferencias((prev) => prev.map((item, i) => i === index ? { ...item, nombre: e.target.value } : item))} placeholder={index === 0 ? "Familiar (otro domicilio)" : `Nombre del conocido ${index}`} className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm" />
                      <input type="tel" required value={ref.telefono} onChange={(e) => setObligadoReferencias((prev) => prev.map((item, i) => i === index ? { ...item, telefono: e.target.value } : item))} placeholder="81 1234 5678" className="w-full py-2.5 px-3 bg-[#1C2541] border border-[#3A4868] rounded-xl text-slate-100 text-sm" />
                      <div className="flex items-center text-xs font-semibold text-slate-500">{index === 0 ? 'Familiar de otro domicilio' : `Conocido ${index}`}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black text-slate-100 mb-3">4. Documentación</h3>
                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 mb-4">
                  <p className="text-xs font-bold text-slate-100">Los mismos documentos solicitados al titular</p>
                  <p className="text-[11px] text-slate-400 mt-1">INE ambos lados y comprobante de domicilio son obligatorios. Los estados de cuenta son opcionales y pueden agregarse después.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {label:'INE Frente', value:obligadoIneFrente, input:obligadoIneFrenteInput, setter:setObligadoIneFrente, name:setObligadoIneFrenteNombre, nameValue:obligadoIneFrenteNombre},
                    {label:'INE Reverso', value:obligadoIneReverso, input:obligadoIneReversoInput, setter:setObligadoIneReverso, name:setObligadoIneReversoNombre, nameValue:obligadoIneReversoNombre},
                  ].map((doc:any) => (
                    <div key={doc.label} className="border border-[#2E3A59] rounded-2xl p-4 bg-[#121824]/60">
                      <div className="flex items-center justify-between mb-3"><span className="text-xs font-bold text-slate-200">{doc.label} <span className="text-red-500">*</span></span>{doc.value && <Check className="w-4 h-4 text-emerald-600" />}</div>
                      <button type="button" onClick={() => doc.input.current?.click()} className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"><Upload className="w-3.5 h-3.5" /> Subir</button>
                      <input ref={doc.input} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={(e) => handleObligadoFile(e, doc.setter, doc.name)} />
                      {doc.nameValue && <p className="text-[11px] text-slate-500 mt-2 truncate">{doc.nameValue}</p>}
                    </div>
                  ))}
                </div>

                {obligadoIneFrente && (
                  <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-slate-100">Extraer datos del obligado con OCR</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Completa automáticamente nombre, CURP, RFC, fecha de nacimiento y sexo. Revisa los datos antes de guardar.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRunObligadoOcr}
                        disabled={isScanningObligado}
                        className="py-2.5 px-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shrink-0"
                      >
                        {isScanningObligado ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Leyendo INE...
                          </>
                        ) : (
                          <>
                            <Scan className="w-4 h-4" />
                            Extraer datos con OCR
                          </>
                        )}
                      </button>
                    </div>
                    {obligadoOcrError && (
                      <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                        {obligadoOcrError}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 border border-[#2E3A59] rounded-2xl p-4 bg-[#121824]/60">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-slate-200">Comprobante de domicilio <span className="text-red-500">*</span></span>
                    {obligadoComprobante && <Check className="w-4 h-4 text-emerald-600" />}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => obligadoComprobanteInput.current?.click()}
                      className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold"
                    >
                      <Upload className="w-3.5 h-3.5 inline mr-1" /> Subir comprobante
                    </button>
                    {obligadoComprobante && (
                      <button
                        type="button"
                        onClick={handleRunObligadoComprobanteOcr}
                        disabled={obligadoDomicilioOcrLoading}
                        className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold"
                      >
                        {obligadoDomicilioOcrLoading ? (
                          <><RefreshCw className="w-3.5 h-3.5 inline mr-1 animate-spin" /> Leyendo domicilio...</>
                        ) : (
                          <><Scan className="w-3.5 h-3.5 inline mr-1" /> Extraer domicilio con OCR</>
                        )}
                      </button>
                    )}
                  </div>

                  <input ref={obligadoComprobanteInput} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={(e)=>{
                    handleObligadoFile(e,setObligadoComprobante,setObligadoComprobanteNombre);
                    setObligadoDomicilioOcrError(null);
                    setObligadoDomicilioOcrSuccess(null);
                  }} />
                  {obligadoComprobanteNombre && (
                    <p className="text-[11px] text-slate-500 mt-2 truncate">{obligadoComprobanteNombre}</p>
                  )}

                  {obligadoDomicilioOcrSuccess && (
                    <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
                      {obligadoDomicilioOcrSuccess}
                    </div>
                  )}

                  {obligadoDomicilioOcrError && (
                    <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                      {obligadoDomicilioOcrError}
                    </div>
                  )}

                  {obligadoDomicilio.domicilioCompleto && (
                    <div className="mt-3 rounded-xl bg-[#1C2541] border border-[#3A4868] p-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Domicilio extraído</p>
                      <p className="text-xs text-slate-200">{obligadoDomicilio.domicilioCompleto}</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 border border-[#2E3A59] rounded-2xl p-4 bg-[#121824]/60">
                  <div className="flex items-center justify-between gap-3 mb-3"><p className="text-xs font-bold text-slate-200">Estados de cuenta <span className="text-[10px] text-slate-500 uppercase font-black">(Opcionales)</span></p><span className="text-[10px] text-amber-400 font-bold">No bloquean el envío</span></div>
                  {modoEstadosCuenta === 'individual' ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        {label:'Mes 1', value:obligadoMes1, ref:obligadoMes1Input, setter:setObligadoMes1, name:setObligadoMes1Nombre, nameValue:obligadoMes1Nombre},
                        {label:'Mes 2', value:obligadoMes2, ref:obligadoMes2Input, setter:setObligadoMes2, name:setObligadoMes2Nombre, nameValue:obligadoMes2Nombre},
                        {label:'Mes 3', value:obligadoMes3, ref:obligadoMes3Input, setter:setObligadoMes3, name:setObligadoMes3Nombre, nameValue:obligadoMes3Nombre},
                      ].map((doc:any)=>(
                        <div key={doc.label} className="border border-[#2E3A59] rounded-xl p-3 bg-[#1C2541]">
                          <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold text-slate-200">{doc.label}</span>{doc.value && <Check className="w-4 h-4 text-emerald-600" />}</div>
                          <button type="button" onClick={()=>doc.ref.current?.click()} className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-bold"><Upload className="w-3 h-3 inline mr-1" />Subir</button>
                          <input ref={doc.ref} type="file" accept="application/pdf,image/png,image/jpeg" className="hidden" onChange={(e)=>handleObligadoFile(e,doc.setter,doc.name)} />
                          {doc.nameValue && <p className="text-[10px] text-slate-500 mt-2 truncate">{doc.nameValue}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <button type="button" onClick={()=>obligadoConsolidadoInput.current?.click()} className="w-full py-3 border-2 border-dashed border-[#3A4868] rounded-xl bg-[#1C2541] text-xs font-bold text-slate-300"><Upload className="w-4 h-4 inline mr-1.5" /> Subir PDF consolidado (3 meses)</button>
                      <input ref={obligadoConsolidadoInput} type="file" accept="application/pdf,image/png,image/jpeg" className="hidden" onChange={(e)=>handleObligadoFile(e,setObligadoConsolidado,setObligadoConsolidadoNombre)} />
                      {obligadoConsolidadoNombre && <p className="text-[11px] text-slate-500 mt-2 truncate">{obligadoConsolidadoNombre}</p>}
                    </div>
                  )}
                </div>

                <div className="mt-4 border border-[#2E3A59] rounded-2xl p-4 bg-[#121824]/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div>
                      <p className="text-xs font-black text-slate-200">Comprobantes de nómina <span className="text-[10px] text-slate-500 uppercase">(Opcional)</span></p>
                      <p className="text-[11px] text-slate-500 mt-1">Puedes adjuntar hasta 3 nóminas del obligado solidario. No se realiza OCR.</p>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">{obligadoNominas.length}/3 cargados</span>
                  </div>

                  {obligadoNominas.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                      {obligadoNominas.map((doc, index) => (
                        <div key={index} className="rounded-xl border border-[#2E3A59] bg-[#121824] p-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                            <p className="text-xs font-semibold text-slate-200 truncate">{doc.archivoNombre || `Nómina ${index + 1}`}</p>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">Nómina {index + 1}</p>
                          <div className="flex gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewModalUrl(doc.archivoUrl);
                                setPreviewModalTitle(`Comprobante de Nómina del Obligado ${index + 1}`);
                              }}
                              className="flex-1 py-1.5 bg-[#1C2541] border border-[#3A4868] text-slate-300 rounded-lg text-[11px] font-semibold"
                            >
                              <Eye className="w-3 h-3 inline mr-1" /> Ver
                            </button>
                            <button
                              type="button"
                              onClick={() => setObligadoNominas((prev) => prev.filter((_, i) => i !== index))}
                              className="py-1.5 px-2.5 bg-[#1C2541] border border-rose-200 text-rose-500 rounded-lg text-[11px] font-semibold"
                              title="Quitar nómina"
                            >
                              <Trash2 className="w-3 h-3 inline" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {obligadoNominas.length < 3 && (
                    <>
                      <button
                        type="button"
                        onClick={() => obligadoNominaInputRef.current?.click()}
                        className="w-full py-3 border-2 border-dashed border-[#3A4868] rounded-xl bg-[#121824] hover:bg-[#18223A] text-center"
                      >
                        <Upload className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                        <span className="text-xs font-bold text-slate-300 block">Subir nóminas del obligado</span>
                        <span className="text-[10px] text-slate-500 block">PDF, PNG, JPG o WEBP · Opcional</span>
                      </button>
                      <input
                        ref={obligadoNominaInputRef}
                        type="file"
                        multiple
                        accept="application/pdf,image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleObligadoNominaFiles}
                      />
                    </>
                  )}
                </div>

              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className={obligadoSolidarioCompleto ? 'text-emerald-700 font-bold' : 'text-amber-700 font-semibold'}>
                  {obligadoSolidarioCompleto ? '✓ Obligado solidario listo para enviar' : 'Pendiente: completa todos los datos y documentos del obligado solidario'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="bg-[#1C2541] border border-[#2E3A59] rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-4 z-20">
          <div className="text-xs text-slate-400">
            <span className="font-bold text-slate-100 block">
              Envío directo a asesor
            </span>
            <span>
              {docsCompletadosCount === 3
                ? '✓ Documentación obligatoria lista para enviar. Estados de cuenta opcionales.'
                : `Se han cargado ${docsCompletadosCount} de los 2 documentos obligatorios`}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={resetForm}
              className="py-2.5 px-4 bg-[#1C2541] hover:bg-[#121824] text-slate-300 border border-[#3A4868] rounded-xl text-xs font-semibold transition cursor-pointer"
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
                  Guardar y Enviar a Asesor
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* DOCUMENT PREVIEW MODAL */}
      {previewModalUrl && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1C2541] rounded-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-[#3A4868]">
            <div className="p-4 border-b border-[#2E3A59] flex items-center justify-between shrink-0">
              <h4 className="text-sm font-bold text-slate-100 truncate pr-4">{previewModalTitle || 'Vista previa'}</h4>
              <button
                type="button"
                onClick={() => setPreviewModalUrl(null)}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-[#18223A] cursor-pointer shrink-0"
                aria-label="Cerrar vista previa"
              >
                ✕
              </button>
            </div>

            <div className="p-3 overflow-hidden flex-1 min-h-0 flex items-center justify-center bg-[#0B132B]">
              {previewRenderableUrl ? (
                previewMimeType === 'application/pdf' ? (
                  <div className="w-full h-full flex flex-col gap-3">
                    <object
                      data={previewRenderableUrl}
                      type="application/pdf"
                      aria-label={previewModalTitle || 'Vista previa PDF'}
                      className="w-full h-full rounded-xl bg-white border border-[#2E3A59]"
                    >
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-[#121824] rounded-xl">
                        <FileText className="w-14 h-14 text-red-400 mx-auto mb-3" />
                        <h5 className="text-base font-black text-white">PDF listo para visualizar</h5>
                        <p className="text-xs text-slate-400 mt-2 mb-5">Tu navegador no pudo mostrar el PDF dentro de la ventana.</p>
                        <a
                          href={previewRenderableUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-3 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2"
                        >
                          Abrir PDF
                        </a>
                      </div>
                    </object>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center overflow-auto rounded-xl bg-[#121824]">
                    <img
                      src={previewRenderableUrl}
                      alt={previewModalTitle || 'Vista previa del documento'}
                      className="max-h-full max-w-full object-contain rounded-xl"
                    />
                  </div>
                )
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center text-center p-6 bg-[#121824] rounded-xl">
                  <FileText className="w-14 h-14 text-slate-500 mx-auto mb-3" />
                  <h5 className="text-base font-black text-white">Preparando documento...</h5>
                  <p className="text-xs text-slate-400 mt-2">La vista previa se está preparando. Cierra y vuelve a abrir el documento si tarda demasiado.</p>
                </div>
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
