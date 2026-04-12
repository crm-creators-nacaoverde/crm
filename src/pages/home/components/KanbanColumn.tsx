import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Deal } from './KanbanSection';
import KanbanCard from './KanbanCard';

// Tooltip via portal — renderizado no <body> para não ser cortado por overflow
function StageDescTooltip({ label, description }: { label: string; description: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const show = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top });
  };
  const hide = () => setPos(null);

  const tooltip = pos ? (
    <div
      className="pointer-events-none"
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y - 8,
        transform: 'translate(-50%, -100%)',
        minWidth: '180px',
        maxWidth: '240px',
        zIndex: 9999,
      }}>
      <div className="bg-gray-900 text-white rounded-xl px-3 py-2.5 shadow-2xl">
        <p className="text-[11px] font-semibold mb-1 leading-snug">{label}</p>
        <p className="text-[10px] text-gray-300 leading-relaxed whitespace-pre-wrap">{description}</p>
      </div>
      <div className="flex justify-center -mt-1.5">
        <div className="w-2.5 h-2.5 bg-gray-900 rotate-45 rounded-sm"></div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={show}
        onMouseLeave={hide}
        className="w-4 h-4 flex items-center justify-center rounded-full text-gray-300 hover:text-gray-500 transition-colors cursor-default flex-shrink-0">
        <i className="ri-information-line text-xs"></i>
      </button>
      {pos && typeof document !== 'undefined' && createPortal(tooltip, document.body)}
    </>
  );
}


interface KanbanColumnProps {
  stage: { id: string; label: string; color: string; description?: string };
  deals: Deal[];
  stageValue: number;
  isDragOver: boolean;
  onDragOver: (stageId: string) => void;
  onDrop: (stageId: string) => void;
  onDragStart: (deal: Deal) => void;
  onDragEnd: () => void;
  onEditDeal: (deal: Deal) => void;
  onDeleteDeal: (id: string) => void;
  canDelete?: boolean;
  onOpenAutomations?: (stage: { id: string; label: string; color: string }) => void;
  onOpenMandatoryTask?: (stage: { id: string; label: string; color: string; mandatory_task_title?: string; mandatory_task_description?: string }) => void;
}

export default function KanbanColumn({
  stage,
  deals,
  stageValue,
  isDragOver,
  onDragOver,
  onDrop,
  onDragStart,
  onDragEnd,
  onEditDeal,
  onDeleteDeal,
  canDelete = true,
  onOpenAutomations,
  onOpenMandatoryTask,
}: KanbanColumnProps) {
  return (
    <div
      className={`flex-shrink-0 w-[272px] flex flex-col rounded-2xl transition-all duration-200 group ${
        isDragOver ? 'bg-[#5de0e6]/10 ring-2 ring-[#5de0e6]/40' : 'bg-gray-50/60'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(stage.id);
      }}
      onDragLeave={() => onDragOver('')}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(stage.id);
      }}
    >
      {/* Column Header */}
      <div className="px-3 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }}></div>
          <span className="text-[13px] font-semibold text-gray-700">{stage.label}</span>
          <span className="text-[11px] text-gray-400 bg-white px-1.5 py-0.5 rounded-md font-medium border border-gray-100">
            {deals.length}
          </span>
          {stage.description && <StageDescTooltip label={stage.label} description={stage.description} />}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-gray-400">
            R$ {stageValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
          {onOpenAutomations && (
            <button
              onClick={() => onOpenAutomations(stage)}
              title="Automações desta etapa"
              className="w-6 h-6 flex items-center justify-center rounded-md text-gray-300 hover:text-[#004aad] hover:bg-[#004aad]/10 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
            >
              <i className="ri-flashlight-line text-sm"></i>
            </button>
          )}
          {onOpenMandatoryTask && (
            <button
              onClick={() => onOpenMandatoryTask(stage)}
              title="Tarefa obrigatória desta etapa"
              className="w-6 h-6 flex items-center justify-center rounded-md text-gray-300 hover:text-[#004aad] hover:bg-[#004aad]/10 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
            >
              <i className="ri-checkbox-circle-line text-sm"></i>
            </button>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 px-2 pb-2 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 340px)' }}>
        {deals.map(deal => (
          <KanbanCard
            key={deal.id}
            deal={deal}
            stageColor={stage.color}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onEdit={onEditDeal}
            onDelete={onDeleteDeal}
            canDelete={canDelete}
          />
        ))}

        {deals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-gray-300">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-gray-100 mb-2">
              <i className="ri-inbox-2-line text-lg"></i>
            </div>
            <span className="text-[11px] text-gray-400">Nenhuma negociação</span>
          </div>
        )}
      </div>
    </div>
  );
}
