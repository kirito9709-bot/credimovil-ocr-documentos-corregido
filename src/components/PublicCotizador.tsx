import React, { useMemo, useState } from 'react';
import { Calculator, ShieldCheck, Car } from 'lucide-react';
import { CotizadorCreditoModal } from './CotizadorCreditoModal';
import { ExpedienteCredito } from '../types';

export const PublicCotizador: React.FC = () => {
  const [open, setOpen] = useState(false);

  const expedienteBase = useMemo(() => ({
    id: 'cotizador-publico',
    folio: 'COTIZACION-PUBLICA',
    pinFondeo: '',
    fechaCreacion: new Date().toISOString(),
    fechaActualizacion: new Date().toISOString(),
    estatus: 'NUEVO',
    ine: {
      nombre: '',
      primerApellido: '',
      segundoApellido: '',
      nombreCompleto: '',
      curp: '',
      rfc: '',
      fechaNacimiento: '',
      sexo: '',
      domicilio: {
        calle: '', numExterior: '', numInterior: '', colonia: '',
        codigoPostal: '', municipio: '', estado: '', domicilioCompleto: ''
      },
      vigencia: {
        emision: '', vigenciaHasta: '', seccion: ''
      }
    },
    autoMarca: '',
    autoModelo: '',
    autoAno: '',
    autoPrecio: 0,
    enganche: 0,
    engancheModo: 'MONTO',
    enganchePorcentaje: 0,
    plazoMeses: 48,
    montoFinanciar: 0
  } as ExpedienteCredito), []);

  return (
    <section className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl">
        <div className="rounded-3xl border border-[#284B73] bg-gradient-to-br from-[#101B38] via-[#18213F] to-[#241C38] shadow-2xl overflow-hidden">
          <div className="p-7 sm:p-10 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-red-600/15 border border-red-500/30 flex items-center justify-center mb-4">
              <Calculator className="w-7 h-7 text-red-400" />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-300 text-[11px] font-black uppercase">
              <ShieldCheck className="w-3.5 h-3.5" /> Sin usuario y sin iniciar sesión
            </div>
            <h1 className="mt-4 text-3xl sm:text-5xl font-black text-white">Cotiza tu crédito</h1>
            <p className="mt-3 max-w-2xl mx-auto text-slate-300 text-sm sm:text-base">
              Calcula una estimación de tu crédito automotriz, enganche, seguro, comisión y mensualidad antes de iniciar tu expediente.
            </p>

            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 hover:bg-red-500 text-white px-7 py-3.5 text-sm font-black shadow-lg shadow-red-900/25 transition"
            >
              <Calculator className="w-5 h-5" />
              Abrir cotizador
            </button>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="rounded-2xl bg-black/20 border border-white/10 p-4">
                <Car className="w-5 h-5 text-red-400 mb-2" />
                <div className="text-xs font-black text-white">Vehículo</div>
                <div className="text-[11px] text-slate-400 mt-1">Captura precio, marca, modelo y año.</div>
              </div>
              <div className="rounded-2xl bg-black/20 border border-white/10 p-4">
                <Calculator className="w-5 h-5 text-red-400 mb-2" />
                <div className="text-xs font-black text-white">Financiamiento</div>
                <div className="text-[11px] text-slate-400 mt-1">Prueba distintos enganches y plazos.</div>
              </div>
              <div className="rounded-2xl bg-black/20 border border-white/10 p-4">
                <ShieldCheck className="w-5 h-5 text-red-400 mb-2" />
                <div className="text-xs font-black text-white">Seguro</div>
                <div className="text-[11px] text-slate-400 mt-1">Compara seguro de contado o financiado.</div>
              </div>
            </div>

            <p className="mt-6 text-[11px] text-slate-500">
              La cotización es estimativa y no constituye aprobación de crédito.
            </p>
          </div>
        </div>
      </div>

      <CotizadorCreditoModal
        expediente={expedienteBase}
        isOpen={open}
        onClose={() => setOpen(false)}
        customerMode
        showRate={false}
      />
    </section>
  );
};
