import { Deal } from './KanbanSection';
import KanbanCard from './KanbanCard';

interface KanbanColumnProps {
  stage: { id: string; label: string; color: string };
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
  canDelete = true
}: KanbanColumnProps) {
  return (
    <div
      className={`flex-shrink-0 w-[272px] flex flex-col rounded-2xl transition-all duration-200 ${
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
        </div>
        <span className="text-[11px] font-medium text-gray-400">
          R$ {stageValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </span>
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
