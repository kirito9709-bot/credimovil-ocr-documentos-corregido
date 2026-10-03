/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { PublicIneCapture } from './components/PublicIneCapture';
import { LoteFondeoPortal } from './components/LoteFondeoPortal';
import { LotePortal } from './components/LotePortal';
import { LoteLoginModal } from './components/LoteLoginModal';
import { AdminPanel } from './components/AdminPanel';
import { AdminLoginModal } from './components/AdminLoginModal';
import { ExpedienteDetailModal } from './components/ExpedienteDetailModal';
import { PrintCaratulaModal } from './components/PrintCaratulaModal';
import { LotesManagerModal } from './components/LotesManagerModal';
import { api } from './services/api';
import { ExpedienteCredito, LoteAuto } from './types';
import { ShieldCheck, Phone, CheckCircle2, Car, Sparkles, Building2 } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'captura' | 'fondeo' | 'admin' | 'lotes' | 'loteportal'>('captura');
  const [lotes, setLotes] = useState<LoteAuto[]>([]);
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [authUser, setAuthUser] = useState<any>(null);

  // Deep linking URL query parameters
  const [urlFolio, setUrlFolio] = useState<string>('');
  const [urlPin, setUrlPin] = useState<string>('');

  // Modals
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showLoteLoginModal, setShowLoteLoginModal] = useState(false);
  const [selectedExpediente, setSelectedExpediente] = useState<ExpedienteCredito | null>(null);
  const [printExpediente, setPrintExpediente] = useState<ExpedienteCredito | null>(null);
  const [showLotesModal, setShowLotesModal] = useState(false);

  // Initial load
  useEffect(() => {
    // Check local storage for auth token
    const token = localStorage.getItem('credimovil_auth_token');
    const savedUser = localStorage.getItem('credimovil_auth_user');
    if (token && savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setIsAdminAuth(true);
        setAuthUser(user);
      } catch {
        localStorage.removeItem('credimovil_auth_token');
        localStorage.removeItem('credimovil_auth_user');
      }
    }

    // Load initial lotes
    loadLotes();

    // Check URL parameters for direct link e.g. /?tab=fondeo&folio=EXP-2026-1042&pin=1234
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const folioParam = params.get('folio');
    const pinParam = params.get('pin');

    if (folioParam) {
      setUrlFolio(folioParam);
    }
    if (pinParam) {
      setUrlPin(pinParam);
    }
    if (tabParam === 'fondeo' || tabParam === 'admin' || tabParam === 'captura') {
      setCurrentTab(tabParam as any);
    }
  }, []);

  const loadLotes = async () => {
    try {
      const res = await api.getLotes();
      if (res.success && res.lotes) {
        setLotes(res.lotes);
      }
    } catch (err) {
      console.error('Failed to load lotes', err);
    }
  };

  const handleAdminLoginSuccess = (user: any) => {
    setIsAdminAuth(true);
    setAuthUser(user);
    setCurrentTab(user?.role === 'lote' ? 'loteportal' : 'admin');
  };

  const handleLoteLoginSuccess = (user: any) => {
    setIsAdminAuth(true);
    setAuthUser(user);
    setShowLoteLoginModal(false);
    setCurrentTab('loteportal');
  };

  const handleAdminLogout = async () => {
    await api.logout();
    setIsAdminAuth(false);
    setAuthUser(null);
    if (currentTab === 'admin') setCurrentTab('captura');
  };

  const handleExpedienteCreated = (newExp: ExpedienteCredito) => {
    // Auto refresh lotes to update statistics
    loadLotes();
  };

  const handleGoToFondeo = (folio: string) => {
    setUrlFolio(folio);
    setCurrentTab('fondeo');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoteCreated = (newLote: LoteAuto) => {
    setLotes((prev) => [...prev, newLote]);
  };

  const handleLoteDeleted = (id: string) => {
    setLotes((prev) => prev.filter((l) => l.id !== id));
  };

  const handleDeleteExpediente = async (id: string) => {
    try {
      await api.deleteExpediente(id);
      setSelectedExpediente(null);
      // Reload lotes stats
      loadLotes();
    } catch (err) {
      alert('Error al eliminar expediente');
    }
  };

  const handleUpdateExpediente = (updated: ExpedienteCredito) => {
    setSelectedExpediente(updated);
    loadLotes();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab === 'lotes') {
            setShowLotesModal(true);
          } else {
            setCurrentTab(tab);
          }
        }}
        isAdminAuth={isAdminAuth}
        onOpenAdminAuth={() => setShowLoginModal(true)}
        onLogoutAdmin={handleAdminLogout}
        onOpenLoteAuth={() => setShowLoteLoginModal(true)}
        authUser={authUser}
        activeLoteCount={lotes.length}
      />

      {/* Main Container */}
      <main className="flex-1">
        {currentTab === 'captura' && (
          <PublicIneCapture
            lotes={lotes}
            onExpedienteCreated={handleExpedienteCreated}
            onGoToFondeo={handleGoToFondeo}
          />
        )}

        {currentTab === 'fondeo' && (
          <LoteFondeoPortal
            initialFolio={urlFolio}
            initialPin={urlPin}
          />
        )}

        {currentTab === 'loteportal' && authUser?.role === 'lote' && (
          <LotePortal authUser={authUser} />
        )}

        {currentTab === 'admin' && (
          <AdminPanel
            isAdminAuth={isAdminAuth}
            onOpenAuth={() => setShowLoginModal(true)}
            authUser={authUser}
            onLogout={handleAdminLogout}
            lotes={lotes}
            onOpenExpediente={(exp) => setSelectedExpediente(exp)}
            onOpenPrint={(exp) => setPrintExpediente(exp)}
            onOpenLotesManager={() => setShowLotesModal(true)}
            onGoToCaptura={() => setCurrentTab('captura')}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-8 px-4 text-center text-xs text-slate-500 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              AC
            </div>
            <span className="font-semibold text-slate-400">
              AutoCred • Plataforma de Crédito Automotriz Directo
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>OCR de INE con IA Multimodal</span>
            <span>•</span>
            <span>Base de Datos Segura</span>
            <span>•</span>
            <span>Módulo de Fondeo sin Intermediarios</span>
          </div>

          <div className="text-slate-500 text-[11px]">
            Conectando Asesores y Lotes de Autos de México
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AdminLoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleAdminLoginSuccess}
      />

      <LoteLoginModal
        isOpen={showLoteLoginModal}
        onClose={() => setShowLoteLoginModal(false)}
        onSuccess={handleLoteLoginSuccess}
      />

      <ExpedienteDetailModal
        expediente={selectedExpediente}
        onClose={() => setSelectedExpediente(null)}
        onUpdate={handleUpdateExpediente}
        onDelete={handleDeleteExpediente}
        onOpenPrint={(exp) => setPrintExpediente(exp)}
      />

      <PrintCaratulaModal
        expediente={printExpediente}
        onClose={() => setPrintExpediente(null)}
      />

      <LotesManagerModal
        isOpen={showLotesModal}
        onClose={() => setShowLotesModal(false)}
        lotes={lotes}
        onLoteCreated={handleLoteCreated}
        onLoteDeleted={handleLoteDeleted}
        canManage={isAdminAuth}
      />
    </div>
  );
}
