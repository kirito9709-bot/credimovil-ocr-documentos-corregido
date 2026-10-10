/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { PublicIneCapture } from './components/PublicIneCapture';
import { PublicCotizador } from './components/PublicCotizador';
import { LoteFondeoPortal } from './components/LoteFondeoPortal';
import { LotePortal } from './components/LotePortal';
import { LoteLoginModal } from './components/LoteLoginModal';
import { AdminPanel } from './components/AdminPanel';
import { AdminLoginModal } from './components/AdminLoginModal';
import { ExpedienteDetailModal } from './components/ExpedienteDetailModal';
import { PrintCaratulaModal } from './components/PrintCaratulaModal';
import { LotesManagerModal } from './components/LotesManagerModal';
import { LotesDashboardModal } from './components/LotesDashboardModal';
import { api } from './services/api';
import { ExpedienteCredito, LoteAuto } from './types';
import { ShieldCheck, Phone, CheckCircle2, Car, Sparkles, Building2 } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'captura' | 'cotizar' | 'fondeo' | 'admin' | 'lotes' | 'lotesdashboard' | 'loteportal'>('captura');
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
  const [pendingAuthTab, setPendingAuthTab] = useState<'admin' | 'lotesdashboard' | null>(null);

  // Initial load
  useEffect(() => {
    // Restore the authenticated session from the HttpOnly cookie.
    // IMPORTANT: load lotes only after we know whether the session exists.
    // Otherwise the public response can race and overwrite the authenticated
    // response (including usersPortal and lot metrics).
    api.getMe()
      .then((res) => {
        if (res?.success && res.user) {
          setIsAdminAuth(true);
          setAuthUser(res.user);
          localStorage.setItem('credimovil_auth_user', JSON.stringify(res.user));
          setShowLoginModal(false);
          setShowLoteLoginModal(false);
          setPendingAuthTab(null);
          if (res.user.role === 'lote') {
            setCurrentTab('loteportal');
          }
          loadLotes();
        } else {
          loadLotes();
        }
      })
      .catch(() => {
        localStorage.removeItem('credimovil_auth_user');
        loadLotes();
      });

    // Support direct links, but immediately remove the PIN from the address bar/history
    // so it is less likely to leak through screenshots, copied URLs or browser history.
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const folioParam = params.get('folio');
    const pinParam = params.get('pin');

    if (folioParam) {
      setUrlFolio(folioParam);
    }
    if (pinParam) {
      setUrlPin(pinParam);
      params.delete('pin');
      const remainingQuery = params.toString();
      const safeUrl = window.location.pathname + (remainingQuery ? `?${remainingQuery}` : '') + window.location.hash;
      window.history.replaceState({}, document.title, safeUrl);
    }
    if (tabParam === 'fondeo' || tabParam === 'admin' || tabParam === 'captura' || tabParam === 'cotizar' || tabParam === 'lotesdashboard') {
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
    if (user?.role === 'lote') {
      setShowLoginModal(false);
      setPendingAuthTab(null);
      setShowLoteLoginModal(true);
      return;
    }
    setIsAdminAuth(true);
    setAuthUser(user);
    loadLotes();
    const destination = pendingAuthTab || 'admin';
    setPendingAuthTab(null);
    setShowLoginModal(false);
    setCurrentTab(destination as any);
  };

  const handleLoteLoginSuccess = (user: any) => {
    if (user?.role !== 'lote') return;
    setIsAdminAuth(true);
    setAuthUser(user);
    setShowLoginModal(false);
    setPendingAuthTab(null);
    setShowLoteLoginModal(false);
    setCurrentTab('loteportal');
    loadLotes();
  };

  const handleAdminLogout = async () => {
    await api.logout();
    setIsAdminAuth(false);
    setAuthUser(null);
    setShowLoginModal(false);
    setShowLoteLoginModal(false);
    setPendingAuthTab(null);
    setCurrentTab('captura');
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

  const handleLoteUpdated = (updatedLote: LoteAuto) => {
    setLotes((prev) => prev.map((lote) => lote.id === updatedLote.id ? updatedLote : lote));
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
    <div className="min-h-screen bg-[#0B132B] text-slate-100 flex flex-col selection:bg-red-200 selection:text-[#041329]">
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab === 'lotes') {
            setShowLotesModal(true);
            return;
          }
          if ((tab === 'admin' || tab === 'lotesdashboard') && !isAdminAuth) {
            setPendingAuthTab(tab === 'lotesdashboard' ? 'lotesdashboard' : 'admin');
            setCurrentTab(tab);
            setShowLoginModal(true);
            return;
          }
          setCurrentTab(tab);
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

        {currentTab === 'cotizar' && <PublicCotizador />}

        {currentTab === 'fondeo' && (
          <LoteFondeoPortal
            initialFolio={urlFolio}
            initialPin={urlPin}
          />
        )}

        {currentTab === 'lotesdashboard' && (
          <LotesDashboardModal
            isOpen={true}
            onClose={() => setCurrentTab('captura')}
            lotes={lotes}
            onLoteCreated={handleLoteCreated}
            onLoteUpdated={handleLoteUpdated}
            onLoteDeleted={handleLoteDeleted}
            canManage={isAdminAuth && (authUser?.role === 'admin' || authUser?.role === 'asesor')}
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
      <footer className="border-t border-[#163A64] bg-[#041329] py-7 px-4 text-center text-xs text-slate-300 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#1C2541] text-red-400 flex items-center justify-center font-bold text-xs">
              AC
            </div>
            <span className="font-semibold text-white">
              AutoCred • Plataforma de Crédito Automotriz Directo
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-300">
            <span>OCR de INE con IA Multimodal</span>
            <span>•</span>
            <span>Base de Datos Segura</span>
            <span>•</span>
            <span>Módulo de Fondeo sin Intermediarios</span>
          </div>

          <div className="text-slate-300 text-[11px]">
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
        onLoteUpdated={handleLoteUpdated}
        onLoteDeleted={handleLoteDeleted}
        canManage={isAdminAuth}
      />
    </div>
  );
}
