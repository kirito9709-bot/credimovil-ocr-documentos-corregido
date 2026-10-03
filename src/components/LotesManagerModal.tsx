import React, { useState } from 'react';
import { Building2, X, Plus, Phone, Mail, MapPin, Check, DollarSign } from 'lucide-react';
import { LoteAuto } from '../types';
import { api } from '../services/api';

interface LotesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  lotes: LoteAuto[];
  onLoteCreated: (lote: LoteAuto) => void;
  onLoteDeleted: (id: string) => void;
  canManage?: boolean;
}

export const LotesManagerModal: React.FC<LotesManagerModalProps> = ({
  isOpen,
  onClose,
  lotes,
  onLoteCreated,
  onLoteDeleted,
  canManage = false,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [contacto, setContacto] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [cuentaClabeDefault, setCuentaClabeDefault] = useState('');
  const [bancoDefault, setBancoDefault] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleDelete = async (lote: LoteAuto) => {
    if (!confirm(`¿Eliminar el lote "${lote.nombre}"?`)) return;
    try {
      await api.deleteLote(lote.id);
      onLoteDeleted(lote.id);
    } catch (err: any) {
      alert(err.message || 'No se pudo eliminar el lote.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await api.createLote({
        nombre,
        contacto,
        telefono,
        correo,
        direccion,
        ciudad,
        cuentaClabeDefault,
        bancoDefault,
      });
      if (res.success && res.lote) {
        onLoteCreated(res.lote);
        setShowAddForm(false);
        setNombre('');
        setContacto('');
        setTelefono('');
        setCorreo('');
        setDireccion('');
        setCiudad('');
        setCuentaClabeDefault('');
        setBancoDefault('');
      }
    } catch (err: any) {
      alert(err.message || 'Error al registrar el lote');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-white">
              Directorio de Lotes de Autos Aliados
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {canManage && !showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="py-1.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Registrar Nuevo Lote
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Add form */}
          {showAddForm && (
            <div className="p-5 bg-slate-950 rounded-2xl border border-slate-800 animate-fadeIn">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-white">
                  Registrar Nuevo Lote / Concesionario
                </h4>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1">Nombre del Lote *</label>
                    <input
                      type="text"
                      required
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="ej. Seminuevos Cumbres"
                      className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Contacto Principal / Gerente</label>
                    <input
                      type="text"
                      value={contacto}
                      onChange={(e) => setContacto(e.target.value)}
                      placeholder="ej. Lic. Roberto Garza"
                      className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1">Teléfono</label>
                    <input
                      type="tel"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="811-234-5678"
                      className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      placeholder="ventas@lote.com"
                      className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Ciudad / Estado</label>
                    <input
                      type="text"
                      value={ciudad}
                      onChange={(e) => setCiudad(e.target.value)}
                      placeholder="Monterrey, N.L."
                      className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1">CLABE Interbancaria para Fondeo</label>
                    <input
                      type="text"
                      maxLength={18}
                      value={cuentaClabeDefault}
                      onChange={(e) => setCuentaClabeDefault(e.target.value)}
                      placeholder="012580001234567890"
                      className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Banco</label>
                    <input
                      type="text"
                      value={bancoDefault}
                      onChange={(e) => setBancoDefault(e.target.value)}
                      placeholder="BBVA México"
                      className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="py-2 px-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl"
                  >
                    {isSubmitting ? 'Guardando...' : 'Guardar Lote'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List of Lotes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lotes.map((lote) => (
              <div
                key={lote.id}
                className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-bold text-white">{lote.nombre}</h4>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{lote.direccion ? `${lote.direccion}, ` : ''}{lote.ciudad}</span>
                    </p>
                  </div>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Aliado Activo
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-300 border-t border-slate-800/80 pt-2.5">
                  {lote.contacto && (
                    <p>
                      <span className="text-slate-500">Contacto:</span>{' '}
                      <strong>{lote.contacto}</strong>
                    </p>
                  )}
                  {lote.telefono && (
                    <p>
                      <span className="text-slate-500">Teléfono:</span>{' '}
                      <a href={`tel:${lote.telefono}`} className="text-emerald-400 hover:underline">
                        {lote.telefono}
                      </a>
                    </p>
                  )}
                  {lote.cuentaClabeDefault && (
                    <p>
                      <span className="text-slate-500">CLABE Fondeo:</span>{' '}
                      <span className="font-mono text-slate-300">{lote.cuentaClabeDefault}</span> ({lote.bancoDefault || 'Banco'})
                    </p>
                  )}
                </div>

{canManage && (
                <div className="flex items-center justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => handleDelete(lote)}
                    className="py-1.5 px-2.5 text-[11px] text-rose-300 bg-rose-950/30 border border-rose-800/50 rounded-lg hover:bg-rose-950/50"
                  >
                    Eliminar lote
                  </button>
                </div>

                )}
                {/* Stats badge */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/60">
                  <span className="text-slate-400">
                    Expedientes referidos: <strong className="text-white">{lote.totalExpedientes || 0}</strong>
                  </span>
                  <span className="text-slate-400">
                    Fondeados: <strong className="text-emerald-400">{lote.totalFondeados || 0}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
