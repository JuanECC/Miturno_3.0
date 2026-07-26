import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showButton, setShowButton] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowButton(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Verificar si ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowButton(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowButton(false);
    }
    setDeferredPrompt(null);
  };

  if (!showButton || dismissed) return null;

  return (
    <div className="fixed bottom-24 right-6 z-50 bg-white rounded-2xl shadow-lg border border-gray-200 p-4 max-w-xs animate-fade-up">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white text-lg flex-shrink-0">
          🏥
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">Instalar Miturno</p>
          <p className="text-xs text-gray-500 mt-0.5">Accede más rápido, como una app</p>
          <button
            onClick={handleInstall}
            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90"
          >
            <Download size={14} />
            Instalar
          </button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}