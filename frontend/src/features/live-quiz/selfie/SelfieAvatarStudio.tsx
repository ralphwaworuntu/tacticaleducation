import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Camera, Check, ImagePlus, Loader2, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { PlayerAvatar } from '../avatars';
import { LiveBrand } from '../ui/GameStage';
import { CARTOON_STYLES, canvasToJpegBlob, renderCartoon, type CartoonStyle } from './cartoon';
import { cropFaceToSquare, drawVideoFrame, loadImageFile } from './cropFace';

type Step = 'consent' | 'capture' | 'photo' | 'styles';

export type SelfieResult = { blob: Blob; previewUrl: string };

export function SelfieAvatarStudio({
  onUse,
  onClose,
}: {
  onUse: (result: SelfieResult) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cropRef = useRef<ImageData | null>(null);
  const [step, setStep] = useState<Step>('consent');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Partial<Record<CartoonStyle, string>>>({});
  const [style, setStyle] = useState<CartoonStyle>('classic');
  const [cameraDenied, setCameraDenied] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);
  useEffect(
    () => () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      Object.values(previews).forEach((url) => url && URL.revokeObjectURL(url));
    },
    // Hanya saat unmount studio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const startCamera = async () => {
    setError(null);
    setCameraDenied(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setStep('capture');
      requestAnimationFrame(() => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        void video.play().catch(() => undefined);
      });
    } catch {
      setCameraDenied(true);
      setError('Kamera tidak diizinkan. Kamu tetap bisa unggah foto atau memakai karakter bawaan.');
    }
  };

  const applyCrop = async (source: CanvasImageSource, width: number, height: number) => {
    setBusy(true);
    setError(null);
    try {
      const cropped = await cropFaceToSquare(source, width, height);
      cropRef.current = cropped.imageData;
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      setPhotoUrl(cropped.preview.toDataURL('image/jpeg', 0.85));
      setNote(cropped.note);
      stopCamera();
      setStep('photo');
    } catch {
      setError('Gagal memotong foto. Coba foto ulang atau unggah gambar lain.');
    } finally {
      setBusy(false);
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video) return;
    const frame = drawVideoFrame(video);
    await applyCrop(frame.canvas, frame.width, frame.height);
  };

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const loaded = await loadImageFile(file);
      await applyCrop(loaded.source, loaded.width, loaded.height);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membaca foto.');
      setBusy(false);
    }
  };

  const cartoonize = async () => {
    const crop = cropRef.current;
    if (!crop) return;
    setBusy(true);
    setError(null);
    try {
      Object.values(previews).forEach((url) => url && URL.revokeObjectURL(url));
      const next: Partial<Record<CartoonStyle, string>> = {};
      for (const item of CARTOON_STYLES) {
        const canvas = renderCartoon(crop, item.id);
        next[item.id] = URL.createObjectURL(await canvasToJpegBlob(canvas, 0.88));
      }
      setPreviews(next);
      setStyle('classic');
      setStep('styles');
    } catch {
      setError('Pemrosesan gagal. Filter Canvas akan dicoba ulang, atau pilih karakter bawaan.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    const crop = cropRef.current;
    if (!crop) return;
    setBusy(true);
    try {
      const canvas = renderCartoon(crop, style);
      const blob = await canvasToJpegBlob(canvas, 0.88);
      const previewUrl = previews[style] ?? URL.createObjectURL(blob);
      onUse({ blob, previewUrl });
      stopCamera();
    } catch {
      setError('Gagal menyiapkan avatar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lq-root lq-stage fixed inset-0 z-50 overflow-y-auto px-4 py-6 text-white">
      <div className="mx-auto w-full max-w-md">
        <LiveBrand compact />
        <h1 className="mt-4 text-center text-2xl font-black tracking-wide text-amber-300">CREATE YOUR AVATAR</h1>
        <p className="mt-1 text-center text-sm text-sky-100/90">Selfie diubah jadi kartun di perangkatmu. Tanpa layanan AI berbayar.</p>

        <div className="lq-card-light mt-5 space-y-4 rounded-[1.75rem] p-5 text-slate-900">
          {step === 'consent' && (
            <>
              <p className="text-sm leading-relaxed text-slate-600">
                Foto dipakai hanya untuk membuat avatar permainan. Selfie asli tidak dikirim ke penyedia AI eksternal dan tidak
                disimpan permanen. Jika kamu di bawah umur, minta persetujuan orang tua/wali.
              </p>
              <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-semibold">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4" />
                Saya (atau orang tua/wali) menyetujui pemrosesan foto untuk avatar Live Quiz.
              </label>
              <button type="button" disabled={!consent} onClick={() => void startCamera()} className="lq-btn lq-btn-electric h-12 w-full">
                <Camera className="h-5 w-5" /> Buka kamera
              </button>
              <label className={cn('lq-btn lq-btn-ghost h-12 w-full cursor-pointer text-slate-800', !consent && 'pointer-events-none opacity-45')}>
                <ImagePlus className="h-5 w-5" /> Upload foto dari galeri
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={!consent}
                  onChange={(e) => void onUpload(e.target.files?.[0])}
                />
              </label>
            </>
          )}

          {step === 'capture' && (
            <>
              <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-full border-4 border-amber-300 bg-slate-900 shadow-xl">
                <video ref={videoRef} playsInline muted autoPlay className="h-full w-full scale-x-[-1] object-cover" />
                <span className="pointer-events-none absolute inset-6 rounded-full border-2 border-dashed border-white/70" />
              </div>
              <p className="text-center text-sm font-semibold text-slate-600">Posisikan wajah di dalam oval, lalu ambil selfie.</p>
              <button type="button" disabled={busy} onClick={() => void capture()} className="lq-btn lq-btn-gold h-12 w-full">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />} Ambil Selfie
              </button>
              <label className="lq-btn lq-btn-ghost h-11 w-full cursor-pointer text-slate-800">
                <ImagePlus className="h-5 w-5" /> Upload foto
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void onUpload(e.target.files?.[0])} />
              </label>
            </>
          )}

          {step === 'photo' && photoUrl && (
            <>
              <img src={photoUrl} alt="Preview selfie" className="mx-auto h-44 w-44 rounded-full object-cover shadow-lg" />
              {note && <p className="text-center text-xs font-semibold text-amber-700">{note}</p>}
              <button type="button" disabled={busy} onClick={() => void cartoonize()} className="lq-btn lq-btn-electric h-12 w-full">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />} Ubah Jadi Kartun
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('consent');
                  setPhotoUrl(null);
                  cropRef.current = null;
                }}
                className="lq-btn lq-btn-ghost h-11 w-full text-slate-800"
              >
                <RefreshCw className="h-4 w-4" /> Foto ulang
              </button>
            </>
          )}

          {step === 'styles' && (
            <>
              <p className="text-center text-xs font-semibold text-slate-500">
                Hasil filter ilustrasi di perangkat. Bukan generator AI kartun — wajah tetap dikenali, tetapi tidak sehalus model berbayar.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {CARTOON_STYLES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStyle(item.id)}
                    className={cn(
                      'rounded-2xl border-2 p-2 text-center',
                      style === item.id ? 'border-amber-400 bg-amber-50' : 'border-transparent bg-slate-50',
                    )}
                  >
                    {previews[item.id] ? (
                      <img src={previews[item.id]} alt={item.name} className="mx-auto h-20 w-20 rounded-full object-cover" />
                    ) : (
                      <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-200">
                        <Sparkles className="h-6 w-6" />
                      </span>
                    )}
                    <span className="mt-2 block text-[11px] font-black leading-tight">{item.name}</span>
                  </button>
                ))}
              </div>
              <p className="text-center text-xs text-slate-500">{CARTOON_STYLES.find((s) => s.id === style)?.hint}</p>
              {previews[style] && (
                <div className="flex justify-center">
                  <PlayerAvatar src={previews[style]} size={96} ring label="Preview avatar kartun" />
                </div>
              )}
              <button type="button" disabled={busy} onClick={() => void confirm()} className="lq-btn lq-btn-gold h-12 w-full">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} Gunakan Avatar
              </button>
            </>
          )}

          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
          {cameraDenied && step === 'consent' && (
            <p className="text-center text-xs font-semibold text-slate-500">Tanpa kamera pun kamu bisa unggah foto atau pilih karakter bawaan.</p>
          )}

          <button type="button" onClick={onClose} className="flex w-full items-center justify-center gap-2 text-sm font-bold text-slate-500">
            <ArrowLeft className="h-4 w-4" /> Kembali ke pilih karakter
          </button>
        </div>
      </div>
      <AnimatePresence>
        {busy && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center">
            <span className="rounded-full bg-slate-900/80 px-4 py-2 text-sm font-bold text-white">Memproses di perangkatmu…</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
