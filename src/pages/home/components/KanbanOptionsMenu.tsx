import { useState, useRef, useEffect } from 'react';

interface KanbanOptionsMenuProps {
  onExport: () => void;
  onReload: () => void;
  onConfigureFunnel: () => void;
  onManageFunnels: () => void;
  isReloading: boolean;
  hideClosedStages: boolean;
  onToggleClosedStages: () => void;
}

export default function KanbanOptionsMenu({
  onExport,
  onReload,
  onConfigureFunnel,
  onManageFunnels,
  isReloading,
  hideClosedStages,
  onToggleClosedStages,
}: KanbanOptionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAction = (action: () => void) => {
    try {
      action();
    } catch (err) {
      console.error('KanbanOptionsMenu action error:', err);
    } finally {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all cursor-pointer ${
          isOpen ? 'bg-gray-50 text-gray-700' : 'bg-white'
        }`}
        title="Opções"
        type="button"
      >
        <i className="ri-more-2-fill text-base"></i>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>

          <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-20 w-52 animate-[fadeIn_0.15s_ease-out]">
            <button
              onClick={() => handleAction(onExport)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
              type="button"
            >
              <div className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-lg">
                <i className="ri-download-cloud-line text-base text-gray-500"></i>
              </div>
              <span className="font-medium">Exportar</span>
            </button>

            <button
              onClick={() => handleAction(onReload)}
              disabled={isReloading}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors disabled:opacity-50"
              type="button"
            >
              <div className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-lg">
                <i className={`ri-refresh-line text-base text-gray-500 ${isReloading ? 'animate-spin' : ''}`}></i>
              </div>
              <span className="font-medium">
                {isReloading ? 'Recarregando...' : 'Recarregar'}
              </span>
            </button>

            <div className="my-1.5 mx-3 border-t border-gray-100"></div>

            <button
              onClick={() => handleAction(onConfigureFunnel)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
              type="button"
            >
              <div className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-lg">
                <i className="ri-settings-3-line text-base text-gray-500"></i>
              </div>
              <span className="font-medium">Configurar Etapas</span>
            </button>

            <button
              onClick={() => handleAction(onManageFunnels)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
              type="button"
            >
              <div className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-lg">
                <i className="ri-stack-line text-base text-gray-500"></i>
              </div>
              <span className="font-medium">Gerenciar Funis</span>
            </button>

            <div className="my-1.5 mx-3 border-t border-gray-100"></div>

            <button
              onClick={() => handleAction(onToggleClosedStages)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
              type="button"
            >
              <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${hideClosedStages ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                <i className={`ri-${hideClosedStages ? 'eye-line text-amber-600' : 'eye-off-line text-emerald-600'} text-base`}></i>
              </div>
              <span className="font-medium">
                {hideClosedStages ? 'Mostrar Etapas Finais' : 'Ocultar Etapas Finais'}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
