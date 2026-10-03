import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X, Check, Image as ImageIcon, AlertCircle, Sparkles } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64: string, fileName?: string) => void;
  title?: string;
  sideText?: string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = 'CrediMóvil - Capturar Credencial INE',
  sideText = 'Anverso (Frente)',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedImage(null);
      return;
    }
    startCamera();
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    stopCamera();
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('La cámara en vivo no está soportada en este navegador.');
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
      setError(
        'El navegador bloqueó la cámara web en vivo. Puedes usar el botón "Cámara Nativa del Teléfono" o subir tu archivo PNG/JPG/PDF.'
      );
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCapturedImage(reader.result);
        stopCamera();
      }
    };
    reader.readAsDataURL(file);
  };

  const confirmCapture = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  const retake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md">
      <div className="relative flex flex-col w-full max-w-xl bg-slate-900 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Camera className="w-5 h-5 text-red-500" />
              <span>{title}</span>
            </h3>
            <p className="text-xs text-slate-400">
              Posiciona el <strong className="text-red-400">{sideText}</strong> sin sombras ni reflejos
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport */}
        <div className="relative aspect-4/3 w-full bg-black flex items-center justify-center overflow-hidden">
          {capturedImage ? (
            capturedImage.startsWith('data:application/pdf') ? (
              <div className="p-8 text-center text-slate-200">
                <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3 font-bold">
                  PDF
                </div>
                <p className="text-sm font-semibold">Documento PDF cargado exitosamente</p>
                <p className="text-xs text-slate-400 mt-1">Listo para análisis con CrediMóvil OCR</p>
              </div>
            ) : (
              <img
                src={capturedImage}
                alt="Captura INE"
                className="w-full h-full object-contain"
              />
            )
          ) : error ? (
            <div className="p-6 text-center text-slate-300 max-w-md space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Acceso a cámara en navegador</p>
                <p className="text-xs text-slate-400 mt-1">{error}</p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="w-full sm:w-auto px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/30"
                >
                  <Camera className="w-4 h-4" />
                  Abrir Cámara del Celular
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 border border-slate-700"
                >
                  <ImageIcon className="w-4 h-4" />
                  Elegir Foto (PNG, JPG, PDF)
                </button>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* INE Outline Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                <div className="relative w-full max-w-md aspect-85/54 border-2 border-dashed border-red-400/90 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-red-500 rounded-tl-xl" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-red-500 rounded-tr-xl" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-red-500 rounded-bl-xl" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-red-500 rounded-br-xl" />

                  <div className="absolute inset-x-0 bottom-3 text-center">
                    <span className="bg-black/80 text-white text-[11px] px-3.5 py-1 rounded-full backdrop-blur-md font-semibold border border-red-500/40">
                      CrediMóvil OCR • Centra la INE aquí
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Hidden inputs */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Native camera trigger using capture="environment" */}
        <input
          type="file"
          ref={nativeCameraInputRef}
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Controls */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          {capturedImage ? (
            <>
              <button
                type="button"
                onClick={retake}
                className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-2 border border-slate-700"
              >
                <RefreshCw className="w-4 h-4" />
                Repetir Foto
              </button>
              <button
                type="button"
                onClick={confirmCapture}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/30"
              >
                <Check className="w-4 h-4" />
                Usar en CrediMóvil
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => nativeCameraInputRef.current?.click()}
                className="py-2.5 px-3 bg-red-950/60 hover:bg-red-900/80 text-red-200 border border-red-800/40 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                title="Abrir cámara del teléfono directamente"
              >
                <Camera className="w-4 h-4 text-red-400" />
                <span>Cámara Nativa</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition flex items-center gap-1.5"
                title="Subir archivo PNG, JPG o PDF"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Galería / PDF</span>
              </button>

              <button
                type="button"
                onClick={takeSnapshot}
                disabled={Boolean(error)}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/25 active:scale-95"
              >
                <Camera className="w-4 h-4" />
                Disparar Foto
              </button>

              <button
                type="button"
                onClick={toggleCamera}
                disabled={Boolean(error)}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 rounded-xl text-xs font-medium transition flex items-center gap-1"
                title="Girar cámara"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
