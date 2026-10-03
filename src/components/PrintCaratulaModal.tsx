import React, { useEffect } from 'react';
import { X, Printer, Car, ShieldCheck } from 'lucide-react';
import { ExpedienteCredito } from '../types';

interface PrintCaratulaModalProps {
  expediente: ExpedienteCredito | null;
  onClose: () => void;
}

export const PrintCaratulaModal: React.FC<PrintCaratulaModalProps> = ({
  expediente,
  onClose,
}) => {
  if (!expediente) return null;

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ine = expediente.ine || {};
  const dom = ine.domicilio || {};
  const montoCotizado = Math.max(0, Number(expediente.montoFinanciar) || 0);
  const plazoCotizado = Math.max(1, Number(expediente.plazoMeses) || 48);
  const capitalMensualCotizado = Math.round((montoCotizado / plazoCotizado) * 100) / 100;
  const interesMensualCotizado = Math.round(montoCotizado * 0.02 * 100) / 100;
  const ivaInteresCotizado = Math.round(interesMensualCotizado * 0.16 * 100) / 100;
  const mensualidadCotizada = montoCotizado > 0
    ? Math.round((capitalMensualCotizado + interesMensualCotizado + ivaInteresCotizado + 260 + 142) * 100) / 100
    : 0;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-2 sm:p-4 backdrop-blur-md overflow-hidden"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-5xl max-h-[94vh] bg-white text-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col print:m-0 print:p-0 print:border-none print:shadow-none">
        {/* Screen Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 text-white print:hidden">
          <div className="flex items-center gap-2">
            <Car className="w-5 h-5 text-red-500" />
            <span className="font-bold text-sm">CrediMóvil - Expediente de Crédito y Trámite de Vehículo</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="py-2 px-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-md shadow-red-900/30"
            >
              <Printer className="w-4 h-4" />
              Imprimir / Guardar PDF
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Sheet */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 print:overflow-visible print:p-6 text-slate-900 bg-white space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between border-b-4 border-red-600 pb-5 bg-gradient-to-r from-[#EEF3F8] to-white px-4 py-4 rounded-2xl">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#071A33] flex items-center justify-center overflow-hidden border border-[#18365C]">
                  <img src="https://credimovil.mx/wp-content/uploads/2024/05/logo-white-170px.png" alt="CrediMóvil" className="w-10 h-auto" />
                </div>
                <div>
                  <div className="text-2xl font-black tracking-tight text-[#071A33]">CREDI<span className="text-red-600">MÓVIL</span></div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Crédito automotriz directo</div>
                </div>
              </div>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Tu auto, más cerca de tus planes • Checklist para Trámite de Vehículo
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Emisión: {new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Folio CrediMóvil</span>
              <span className="text-xl font-mono font-black text-red-600">
                {expediente.folio}
              </span>
              <div className="mt-1">
                <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-300">
                  Estatus: {expediente.estatus}
                </span>
              </div>
            </div>
          </div>

          {/* 1. Datos del Solicitante (INE & CrediMóvil Checklist) */}
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 bg-slate-100 px-3 py-1.5 rounded mb-3 border-l-4 border-red-600">
              1. Datos del Solicitante (Cotejo Oficial INE)
            </h2>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="col-span-2">
                <span className="text-slate-500 block">Nombre Completo:</span>
                <span className="font-bold text-slate-900 text-sm">
                  {ine.nombreCompleto || `${ine.nombre || ''} ${ine.primerApellido || ''} ${ine.segundoApellido || ''}`}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">CURP:</span>
                <span className="font-mono font-bold text-slate-900">
                  {ine.curp || 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">RFC del Cliente:</span>
                <span className="font-mono font-bold text-slate-900">
                  {ine.rfc || (ine.curp ? ine.curp.substring(0, 10) : 'N/A')}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">Nacimiento / Sexo:</span>
                <span className="text-slate-900 font-medium">
                  {ine.fechaNacimiento || 'N/A'} ({ine.sexo || 'N/A'})
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">Teléfono de Contacto:</span>
                <span className="text-slate-900 font-bold">
                  {expediente.telefono || 'N/A'}
                </span>
              </div>

              <div className="col-span-3">
                <span className="text-slate-500 block">
                  {expediente.domicilioCoincideConIne === false
                    ? 'Domicilio Actual (Validado con Comprobante de Agua o Luz CFE):'
                    : 'Domicilio Oficial (Registrado en INE):'}
                </span>
                <span className="text-slate-900 font-medium">
                  {dom.domicilioCompleto ||
                    `${dom.calle || ''} #${dom.numExterior || ''}, Col. ${dom.colonia || ''}, C.P. ${dom.codigoPostal || ''}, ${dom.municipio || ''}, ${dom.estado || ''}`}
                </span>
                {expediente.domicilioCoincideConIne === false && (
                  <span className="inline-block mt-0.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                    ✓ Comprobante de servicio validado por asesor
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 2. Lote & Vehículo */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 bg-slate-100 px-3 py-1.5 rounded mb-3 border-l-4 border-red-600">
                2. Lote Asociado & Fondeo
              </h2>
              <div className="space-y-1.5 text-xs">
                <p>
                  <span className="text-slate-500">Lote Aliado:</span>{' '}
                  <strong className="text-slate-900">{expediente.loteNombre}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Contacto Vendedor:</span>{' '}
                  <span className="text-slate-800">{expediente.asesorLoteContacto || 'Mostrador'}</span>
                </p>
                <p>
                  <span className="text-slate-500">CLABE Dispersión:</span>{' '}
                  <span className="font-mono font-bold text-slate-900">{expediente.cuentaClabeLote || 'Pendiente'}</span>
                </p>
                <p>
                  <span className="text-slate-500">Banco Receptor:</span>{' '}
                  <span className="text-slate-800">{expediente.bancoLote || 'Por asignar'}</span>
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 bg-slate-100 px-3 py-1.5 rounded mb-3 border-l-4 border-red-600">
                3. Unidad a Financiar
              </h2>
              <div className="space-y-1.5 text-xs">
                <p>
                  <span className="text-slate-500">Vehículo:</span>{' '}
                  <strong className="text-slate-900">
                    {expediente.autoMarca} {expediente.autoModelo} ({expediente.autoAno})
                  </strong>
                </p>
                <p>
                  <span className="text-slate-500">Tipo de Unidad:</span>{' '}
                  <span className="text-slate-800">{expediente.esVehiculoLegalizado ? 'Vehículo Legalizado / Importado' : 'Vehículo Nacional'}</span>
                </p>
                <p>
                  <span className="text-slate-500">Financiera Asignada:</span>{' '}
                  <strong className="text-red-700">{expediente.financieraAsignada || 'CrediMóvil'}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* 3. Condiciones Financieras */}
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 bg-slate-100 px-3 py-1.5 rounded mb-3 border-l-4 border-red-600">
              4. Desglose del Financiamiento
            </h2>

            <table className="w-full text-xs border border-slate-300">
              <thead className="bg-slate-50 border-b border-slate-300">
                <tr>
                  <th className="py-2 px-3 text-left">Valor Vehículo</th>
                  <th className="py-2 px-3 text-left">Enganche</th>
                  <th className="py-2 px-3 text-left font-black text-slate-950">Monto Fondeo al Lote</th>
                  <th className="py-2 px-3 text-left">Plazo</th>
                  <th className="py-2 px-3 text-left">Tasa Anual</th>
                  <th className="py-2 px-3 text-left font-black">Mensualidad Aprox.</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-2 px-3">${(expediente.autoPrecio || 0).toLocaleString('es-MX')}</td>
                  <td className="py-2 px-3">${(expediente.enganche || 0).toLocaleString('es-MX')}</td>
                  <td className="py-2 px-3 font-black text-red-600 text-sm">
                    ${(expediente.montoFinanciar || 0).toLocaleString('es-MX')} MXN
                  </td>
                  <td className="py-2 px-3">{expediente.plazoMeses} meses</td>
                  <td className="py-2 px-3">28%</td>
                  <td className="py-2 px-3 font-bold">${mensualidadCotizada.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 4. Checklist CrediMóvil */}
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 bg-slate-100 px-3 py-1.5 rounded mb-3 border-l-4 border-red-600">
              5. Checklist de Documentación CrediMóvil
            </h2>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {(expediente.documentosFondeo || []).map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-1.5 border border-slate-200 rounded"
                >
                  <span className="truncate pr-2">{doc.nombre}</span>
                  <span
                    className={`font-bold px-1.5 py-0.5 rounded text-[10px] uppercase ${
                      doc.estatus === 'APROBADO'
                        ? 'bg-emerald-100 text-emerald-800'
                        : doc.estatus === 'SUBIDO'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {doc.estatus}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2 print:hidden">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs"
            >
              Cerrar expediente
            </button>
          </div>

          {/* Signatures */}
          <div className="pt-8 grid grid-cols-3 gap-8 text-center text-xs">
            <div>
              <div className="border-t border-slate-900 pt-2 font-bold text-slate-900">
                {ine.nombreCompleto || 'Firma del Cliente'}
              </div>
              <p className="text-[10px] text-slate-500">Acreditado</p>
            </div>

            <div>
              <div className="border-t border-slate-900 pt-2 font-bold text-slate-900">
                {expediente.asesorLoteContacto || 'Representante del Lote'}
              </div>
              <p className="text-[10px] text-slate-500">Lote Distribuidor</p>
            </div>

            <div>
              <div className="border-t border-slate-900 pt-2 font-bold text-slate-900">
                Asesor CrediMóvil
              </div>
              <p className="text-[10px] text-slate-500">Mesa de Dictamen</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
