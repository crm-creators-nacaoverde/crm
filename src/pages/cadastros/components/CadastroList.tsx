// src/pages/cadastros/components/CadastroList.tsx
import { useState } from 'react';

export interface CadastroItem {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  [key: string]: any;
}

interface CadastroListProps {
  items: CadastroItem[];
  loading?: boolean;
  onToggle:   (item: CadastroItem) => Promise<void>;
  onEdit:     (item: CadastroItem) => void;
  onDelete:   (item: CadastroItem) => Promise<void>;
  onReorder:  (id: string, dir: 'up' | 'down') => Promise<void>;
  renderBadge?: (item: CadastroItem) => React.ReactNode;
  renderExtra?: (item: CadastroItem) => React.ReactNode;
  emptyMessage?: string;
  blockDelete?: (item: CadastroItem) => string | null; // retorna mensagem se bloqueado
}

export default function CadastroList({
  items, loading, onToggle, onEdit, onDelete, onReorder,
  renderBadge, renderExtra, emptyMessage = 'Nenhum item cadastrado.',
  blockDelete,
}: CadastroListProps) {
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [confirmId, setConfirmId]     = useState<string | null>(null);
  const [blockMsg, setBlockMsg]       = useState<string | null>(null);
  const [togglingId, setTogglingId]   = useState<string | null>(null);

  const handleDelete = async (item: CadastroItem) => {
    if (blockDelete) {
      const msg = blockDelete(item);
      if (msg) { setBlockMsg(msg); return; }
    }
    setConfirmId(item.id);
  };

  const confirmDelete = async (item: CadastroItem) => {
    setDeletingId(item.id);
    await onDelete(item);
    setConfirmId(null);
    setDeletingId(null);
  };

  const handleToggle = async (item: CadastroItem) => {
    setTogglingId(item.id);
    await onToggle(item);
    setTogglingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-7 h-7 border-2 border-[#5de0e6] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-6">
        <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
          <i className="ri-inbox-line text-2xl text-gray-300"></i>
        </div>
        <p className="text-sm text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-50">
      {items.map((item, idx) => (
        <div key={item.id}
          className={`flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors group ${!item.is_active ? 'opacity-60' : ''}`}>

          {/* Reordenar */}
          <div className="flex flex-col gap-0.5 flex-shrink-0">
            <button onClick={() => onReorder(item.id, 'up')} disabled={idx === 0}
              className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-gray-500 disabled:opacity-20 cursor-pointer transition-colors">
              <i className="ri-arrow-up-s-line text-sm"></i>
            </button>
            <button onClick={() => onReorder(item.id, 'down')} disabled={idx === items.length - 1}
              className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-gray-500 disabled:opacity-20 cursor-pointer transition-colors">
              <i className="ri-arrow-down-s-line text-sm"></i>
            </button>
          </div>

          {/* Badge / ícone */}
          {renderBadge && (
            <div className="flex-shrink-0">{renderBadge(item)}</div>
          )}

          {/* Nome + extra */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
            {renderExtra && (
              <div className="mt-0.5">{renderExtra(item)}</div>
            )}
          </div>

          {/* Ações */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {/* Toggle ativo/inativo */}
            <button
              onClick={() => handleToggle(item)}
              disabled={togglingId === item.id}
              title={item.is_active ? 'Desativar' : 'Ativar'}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all ${item.is_active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-100'}`}>
              <i className={`${item.is_active ? 'ri-toggle-line' : 'ri-toggle-fill'} text-base`}></i>
            </button>

            {/* Editar */}
            <button onClick={() => onEdit(item)}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#004aad] hover:bg-[#004aad]/5 rounded-lg cursor-pointer transition-all">
              <i className="ri-edit-line text-sm"></i>
            </button>

            {/* Excluir */}
            {confirmId === item.id ? (
              <div className="flex items-center gap-1">
                <button onClick={() => confirmDelete(item)} disabled={deletingId === item.id}
                  className="text-[10px] font-semibold text-white bg-rose-600 hover:bg-rose-700 px-2 py-1 rounded-lg cursor-pointer transition-colors">
                  {deletingId === item.id ? '...' : 'Confirmar'}
                </button>
                <button onClick={() => setConfirmId(null)}
                  className="text-[10px] font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg cursor-pointer transition-colors">
                  Cancelar
                </button>
              </div>
            ) : (
              <button onClick={() => handleDelete(item)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-all">
                <i className="ri-delete-bin-line text-sm"></i>
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Modal de bloqueio de exclusão */}
      {blockMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setBlockMsg(null)}>
          <div className="absolute inset-0 bg-black/30"></div>
          <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-lock-line text-2xl text-amber-500"></i>
            </div>
            <h3 className="text-base font-semibold text-gray-900 text-center mb-2">Exclusão bloqueada</h3>
            <p className="text-sm text-gray-500 text-center mb-5">{blockMsg}</p>
            <button onClick={() => setBlockMsg(null)}
              className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 cursor-pointer transition-colors">
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
