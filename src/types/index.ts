export interface IneData {
  nombre: string;
  primerApellido: string;
  segundoApellido: string;
  nombreCompleto: string;
  curp: string;
  rfc: string; // Generado automáticamente con opción de corrección
  claveElector?: string;
  fechaNacimiento: string;
  sexo: 'H' | 'M' | 'X' | '';
  edad?: number;
  domicilio: {
    calle: string;
    numExterior: string;
    numInterior: string;
    colonia: string;
    codigoPostal: string;
    municipio: string;
    estado: string;
    domicilioCompleto: string;
  };
  vigencia: {
    emision: string;
    vigenciaHasta: string;
    seccion: string;
  };
  ocrCic?: string;
  tipoCredencial?: string;
  calidadImagen?: 'BUENA' | 'ACEPTABLE' | 'BORROSA';
  observaciones?: string[];
}

export type EstatusCredito =
  | 'NUEVO'
  | 'PRE_APROBADO'
  | 'EN_EVALUACION'
  | 'APROBADO'
  | 'CONTRATO'
  | 'GPS'
  | 'FONDEO'
  | 'FONDEO_PENDIENTE'
  | 'FONDEO_REVISION'
  | 'FONDEADO'
  | 'RECHAZADO';

export type EstatusDocumentoFondeo = 'PENDIENTE' | 'SUBIDO' | 'APROBADO' | 'RECHAZADO';

export type CategoriaDocumento = 'INICIO_CREDITO' | 'VEHICULO_BASICA' | 'VEHICULO_LEGALIZADO' | 'PAGO_FONDEO';

export interface NominaDocumento {
  archivoUrl?: string;
  archivoNombre?: string;
  archivoTipo?: string;
  archivoTamano?: number;
  fechaSubida?: string;
}

export interface DocumentoFondeo {
  id: string;
  categoria: CategoriaDocumento;
  tipo: string;
  nombre: string;
  descripcion: string;
  requerido: boolean;
  estatus: EstatusDocumentoFondeo;
  archivoUrl?: string; // persisted /api/... document URL (legacy base64 is still supported for migration)
  archivoNombre?: string;
  archivoTipo?: string; // 'png' | 'jpeg' | 'pdf'
  archivoTamano?: string;
  fechaSubida?: string;
  subidoPor?: string;
  observaciones?: string;
  fechaRevision?: string;
}

export interface ReferenciaPersonal {
  nombre: string;
  telefono: string;
  relacion: string;
  esFamiliar: boolean;
  ciudad?: string;
}

export interface EstadoCuentaMovimiento {
  fecha: string;
  descripcion: string;
  referencia?: string;
  tipo: 'INGRESO' | 'EGRESO';
  monto: number;
  cargo?: number;
  abono?: number;
  clasificacion?: 'COLUMNAS' | 'INFERIDA' | string;
  categoria?: string;
  saldo?: number;
  mes?: string;
}

export interface EstadosCuentaValidacion {
  estado: 'OK' | 'REVISAR';
  filasLeidas: number;
  filasDuplicadas: number;
  filasConSaldoComparables: number;
  filasSaldoCorrectas: number;
  inconsistencias: string[];
}

export interface EstadosCuentaAnalisisDetalle {
  procesadoEn: string;
  bancoEmisor?: string;
  cuentaUltimos4?: string;
  filasLeidas?: number;
  filasDuplicadas?: number;
  validacion?: EstadosCuentaValidacion;
  movimientos: EstadoCuentaMovimiento[];
  resumen: {
    ingresos: number;
    egresos: number;
    diferencia: number;
    movimientos: number;
  };
}

export interface EstadosCuentaAnalisis {
  mes1Url?: string;
  mes1Nombre?: string;
  mes2Url?: string;
  mes2Nombre?: string;
  mes3Url?: string;
  mes3Nombre?: string;
  archivoConsolidadoUrl?: string;
  archivoConsolidadoNombre?: string;
  bancoEmisor?: string;
  fechaSubida?: string;
}

export interface EstadosCuentaAnalisisResultado {
  procesadoEn: string;
  meses: Record<string, EstadosCuentaAnalisisDetalle>;
  movimientos: EstadoCuentaMovimiento[];
  validacionGlobal?: {
    estado: 'OK' | 'REVISAR';
    documentos: number;
    documentosOK: number;
    inconsistencias: string[];
  };
  resumen: {
    ingresos: number;
    egresos: number;
    diferencia: number;
    movimientos: number;
  };
}

export interface ObligadoSolidarioDocumentos {
  requerido: boolean;
  nombre?: string;
  curp?: string;
  rfc?: string;
  fechaNacimiento?: string;
  sexo?: string;
  telefono?: string;
  correo?: string;
  ingresoMensualAprox?: number;
  tiempoViviendoDomicilio?: string;
  casaPropiaORentada?: 'PROPIA' | 'RENTADA' | 'FAMILIAR' | '';
  tiempoEnTrabajo?: string;
  nombreUbicacionEmpleo?: string;
  direccionEmpleo?: string;
  domicilio?: IneData['domicilio'];
  dependientesEconomicos?: number;
  estadoCivil?: 'SOLTERO' | 'CASADO' | 'UNION_LIBRE' | 'DIVORCIADO' | 'VIUDO' | '';
  referenciasPersonales?: ReferenciaPersonal[];
  fotoIneFrente?: string;
  fotoIneFrenteNombre?: string;
  fotoIneReverso?: string;
  fotoIneReversoNombre?: string;
  comprobanteDomicilioUrl?: string;
  comprobanteDomicilioNombre?: string;
  estadosCuenta?: EstadosCuentaAnalisis;
  nominas?: NominaDocumento[];
  estadosCuentaAnalisis?: { procesadoEn: string; meses: Record<string, EstadosCuentaAnalisisDetalle>; movimientos: EstadoCuentaMovimiento[]; resumen: { ingresos: number; egresos: number; diferencia: number; movimientos: number } };
}

export interface ExpedienteCredito {
  id: string;
  folio: string; // e.g. EXP-2026-1001
  pinFondeo: string; // 4 digits for dealership access
  fechaCreacion: string;
  fechaActualizacion: string;
  fechaFondeo?: string;
  estatus: EstatusCredito;

  // 1. Identificación Oficial (INE por los 2 lados)
  ine: IneData;
  fotoIneFrente?: string; // persisted /api/... document URL (legacy data URI supported)
  fotoIneReverso?: string; // persisted /api/... document URL (legacy data URI supported)

  // 2. Comprobante de Domicilio (Agua o Luz CFE)
  domicilioCoincideConIne?: boolean;
  comprobanteDomicilioActualUrl?: string; // Agua o Luz
  comprobanteDomicilioActualNombre?: string;
  tipoComprobanteDomicilio?: 'CFE_LUZ' | 'AGUA' | 'OTRO';

  // 3. Estados de Cuenta de los últimos 3 meses para Análisis
  estadosCuenta?: EstadosCuentaAnalisis;
  nominas?: NominaDocumento[];
  estadosCuentaAnalisis?: EstadosCuentaAnalisisResultado;

  // 4. Checklist Inicio de Crédito Automotriz (CrediMóvil)
  telefono: string;
  correo: string;
  ingresoMensualAprox?: number;
  tiempoViviendoDomicilio?: string;
  casaPropiaORentada?: 'PROPIA' | 'RENTADA' | 'FAMILIAR' | '';
  tiempoEnTrabajo?: string;
  nombreUbicacionEmpleo?: string;
  direccionEmpleo?: string;
  giroActividadEmpresa?: string;
  dependientesEconomicos?: number;
  estadoCivil?: 'SOLTERO' | 'CASADO' | 'UNION_LIBRE' | 'DIVORCIADO' | 'VIUDO' | '';
  referenciasPersonales?: ReferenciaPersonal[];
  obligadoSolidario?: ObligadoSolidarioDocumentos;

  // 3. Datos del Lote de Autos
  loteId?: string;
  loteNombre: string;
  asesorLoteContacto?: string;
  telefonoLote?: string;
  correoLote?: string;

  // 4. Datos del Vehículo
  autoMarca: string;
  autoModelo: string;
  autoAno: number;
  autoVersion?: string;
  autoPrecio: number;
  autoVin?: string;
  esVehiculoLegalizado: boolean;

  // 5. Términos Financieros
  enganche: number;
  engancheModo?: 'PORCENTAJE' | 'MONTO';
  enganchePorcentaje?: number;
  montoFinanciar: number;
  plazoMeses: number; // 12, 24, 36, 48
  tasaInteresAnual?: number;
  mensualidadEstimada?: number;
  financieraAsignada?: string;

  // 6. Checklist de Documentación de Fondeo y Vehículo (CrediMóvil)
  documentosFondeo: DocumentoFondeo[];
  fondeoMontoLiquidado?: number;
  cuentaClabeLote?: string;
  bancoLote?: string;

  // Notas internas del asesor
  notasAsesor?: string;
}

export interface LoteUsuarioPortal {
  id: string;
  nombre: string;
  username: string;
  activo: boolean;
  created_at?: string;
}

export interface LoteAuto {
  id: string;
  nombre: string;
  contacto: string;
  telefono: string;
  correo: string;
  direccion: string;
  ciudad: string;
  cuentaClabeDefault?: string;
  bancoDefault?: string;
  totalExpedientes?: number;
  totalFondeados?: number;
  usuariosPortal?: LoteUsuarioPortal[];
}