import { useState, useEffect } from 'react';
import Modal from '../../../components/base/Modal';
import { useActivityLog } from '../../../hooks/useActivityLog';

export interface FunnelStage {
  id: string;
  label: string;
  color: string;
  description?: string;
}

interface FunnelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  stages: FunnelStage[];
  onSave: (stages: FunnelStage[]) => void;
  funnelId: string;
}

const colorOptions = [
  '#94a3b8', '#38bdf8', '#fbbf24', '#a78bfa', '#fb923c',
  '#f472b6', '#34d399', '#f87171', '#6ee7b7', '#818cf8',
  '#facc15', '#fb7185', '#2dd4bf', '#c084fc', '#f97316',
];

// ─── Tooltip dark bubble (igual ao da imagem) ─────────────────
function StageTooltip({ label, description }: { label: string; description?: string }) {
  const [visible, setVisible] = useState(false);
  if (!description) return null;

  return (
    <div className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}>
      <button type="button"
        className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 transition-colors cursor-default flex-shrink-0">
        <i className="ri-information-line text-sm"></i>
      </button>

      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none"
          style={{ minWidth: '200px', maxWidth: '260px' }}>
          {/* Bubble */}
          <div className="bg-gray-900 text-white rounded-xl px-3.5 py-3 shadow-2xl">
            <p className="text-[12px] font-semibold mb-1 leading-snug">{label}</p>
            <p className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap">{description}</p>
          </div>
          {/* Arrow */}
          <div className="flex justify-center -mt-1.5">
            <div className="w-3 h-3 bg-gray-900 rotate-45 rounded-sm"></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────
export default function FunnelConfigModal({
  isOpen,
  onClose,
  stages,
  onSave,
  funnelId,
}: FunnelConfigModalProps) {
  const { logActivity } = useActivityLog();
  const [editStages, setEditStages] = useState<FunnelStage[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [editingColor, setEditingColor] = useState<string | null>(null);
  const [expandedDesc, setExpandedDesc] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEditStages(stages.map(s => ({ ...s })));
      setHasChanges(false);
      setEditingColor(null);
      setExpandedDesc(null);
    }
  }, [isOpen, stages]);

  const updateStage = (id: string, field: 'label' | 'color' | 'description', value: string) => {
    setEditStages(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    setHasChanges(true);
  };

  const addStage = () => {
    const newId = `stage_${Date.now()}`;
    const usedColors = editStages.map(s => s.color);
    const availableColor = colorOptions.find(c => !usedColors.includes(c)) || colorOptions[0];
    setEditStages(prev => [
      ...prev.slice(0, -2),
      { id: newId, label: 'Nova Etapa', color: availableColor, description: '' },
      ...prev.slice(-2),
    ]);
    setHasChanges(true);
    setTimeout(() => setExpandedDesc(newId), 50);
  };

  const removeStage = (id: string) => {
    if (editStages.length <= 3) return;
    if (id === 'won' || id === 'lost') return;
    setEditStages(prev => prev.filter(s => s.id !== id));
    setHasChanges(true);
  };

  const handleDragStart = (index: number) => {
    const stage = editStages[index];
    if (stage.id === 'won' || stage.id === 'lost') return;
    setDragIndex(index);
  };
  const handleDragOver = (index: number) => {
    if (dragIndex === null) return;
    const targetStage = editStages[index];
    if (targetStage.id === 'won' || targetStage.id === 'lost') return;
    setDragOverIndex(index);
  };
  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null); setDragOverIndex(null); return;
    }
    const targetStage = editStages[index];
    if (targetStage.id === 'won' || targetStage.id === 'lost') {
      setDragIndex(null); setDragOverIndex(null); return;
    }
    const newStages = [...editStages];
    const [moved] = newStages.splice(dragIndex, 1);
    newStages.splice(index, 0, moved);
    setEditStages(newStages);
    setHasChanges(true);
    setDragIndex(null); setDragOverIndex(null);
  };

  const handleSave = () => {
    const valid = editStages.every(s => s.label.trim().length > 0);
    if (!valid) { alert('Todas as etapas precisam ter um nome.'); return; }
    logActivity({
      action: 'update', module: 'funnels', entityId: funnelId,
      entityName: 'Etapas do Funil', details: { before: stages, after: editStages },
    });
    onSave(editStages);
    onClose();
  };

  const wonStage = editStages.find(s => s.id === 'won');
  const lostStage = editStages.find(s => s.id === 'lost');
  const pipelineStages = editStages.filter(s => s.id !== 'won' && s.id !== 'lost');

  // ─── Bloco reutilizável: campo de descrição ────────────────
  const DescriptionField = ({ stageId, value, bg = 'bg-gray-50' }: { stageId: string; value: string; bg?: string }) => (
    <div className={`px-3 pb-3`}>
      <div className={`flex items-start gap-2 ${bg} rounded-xl p-2.5 border border-gray-100`}>
        <i className="ri-chat-3-line text-gray-400 text-sm mt-[7px] flex-shrink-0"></i>
        <div className="flex-1">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Descrição da etapa</p>
          <textarea
            value={value}
            onChange={e => updateStage(stageId, 'description', e.target.value)}
            placeholder="Explique o objetivo desta etapa. Ex: Leads que já receberam proposta mas ainda não responderam."
            rows={2}
            className="w-full text-xs text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6] transition-all"
            maxLength={200}
          />
          <p className="text-[10px] text-gray-300 text-right mt-0.5">{value.length}/200</p>
        </div>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configurar Etapas do Funil"
      subtitle="Personalize as etapas do seu pipeline de vendas"
      size="md"
    >
      <div className="space-y-5">

        {/* ── Pipeline stages ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <i className="ri-flow-chart text-brand-500 text-base"></i>
              <h4 className="text-sm font-semibold text-gray-800">Etapas do Pipeline</h4>
            </div>
            <span className="text-[11px] text-gray-400">{pipelineStages.length} etapas</span>
          </div>

          <div className="space-y-2">
            {pipelineStages.map((stage, index) => {
              const globalIndex = editStages.indexOf(stage);
              const isDragging = dragIndex === globalIndex;
              const isDragOver = dragOverIndex === globalIndex;
              const isExpanded = expandedDesc === stage.id;

              return (
                <div key={stage.id}
                  draggable
                  onDragStart={() => handleDragStart(globalIndex)}
                  onDragOver={e => { e.preventDefault(); handleDragOver(globalIndex); }}
                  onDrop={() => handleDrop(globalIndex)}
                  onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                  className={`rounded-xl border transition-all duration-200 group
                    ${isDragging ? 'opacity-40 scale-95' : ''}
                    ${isDragOver ? 'border-brand-300 bg-brand-50/30' : 'border-gray-100 bg-white hover:border-gray-200'}`}>

                  {/* Linha principal */}
                  <div className="flex items-center gap-3 p-3">
                    {/* Drag handle */}
                    <div className="w-5 h-5 flex items-center justify-center text-gray-300 cursor-grab active:cursor-grabbing hover:text-gray-500 transition-colors">
                      <i className="ri-draggable text-base"></i>
                    </div>
                    {/* Order */}
                    <div className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-md text-[11px] font-bold text-gray-400 flex-shrink-0">
                      {index + 1}
                    </div>
                    {/* Color picker */}
                    <div className="relative">
                      <button
                        onClick={() => setEditingColor(editingColor === stage.id ? null : stage.id)}
                        className="w-7 h-7 rounded-lg border-2 border-white shadow-sm cursor-pointer hover:scale-110 transition-transform flex-shrink-0"
                        style={{ backgroundColor: stage.color }} title="Alterar cor" />
                      {editingColor === stage.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setEditingColor(null)}></div>
                          <div className="absolute left-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 p-3 z-20 w-[200px]">
                            <p className="text-[11px] font-medium text-gray-500 mb-2">Escolha uma cor</p>
                            <div className="grid grid-cols-5 gap-2">
                              {colorOptions.map(color => (
                                <button key={color}
                                  onClick={() => { updateStage(stage.id, 'color', color); setEditingColor(null); }}
                                  className={`w-8 h-8 rounded-lg cursor-pointer hover:scale-110 transition-transform border-2
                                    ${stage.color === color ? 'border-gray-800 shadow-md' : 'border-transparent'}`}
                                  style={{ backgroundColor: color }} />
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    {/* Label */}
                    <input type="text" value={stage.label}
                      onChange={e => updateStage(stage.id, 'label', e.target.value)}
                      className="flex-1 text-sm font-medium text-gray-800 bg-transparent border-none outline-none focus:bg-gray-50 rounded-lg px-2 py-1 -mx-2 transition-colors"
                      placeholder="Nome da etapa" />
                    {/* Botão descrição */}
                    <button type="button"
                      onClick={() => setExpandedDesc(isExpanded ? null : stage.id)}
                      title={isExpanded ? 'Ocultar descrição' : stage.description ? 'Editar descrição' : 'Adicionar descrição'}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer flex-shrink-0
                        ${stage.description
                          ? 'text-[#004aad] bg-[#004aad]/10'
                          : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100 opacity-0 group-hover:opacity-100'}`}>
                      <i className={`${isExpanded ? 'ri-chat-3-fill' : 'ri-chat-3-line'} text-sm`}></i>
                    </button>
                    {/* Remove */}
                    {editStages.length > 3 && (
                      <button onClick={() => removeStage(stage.id)}
                        className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer flex-shrink-0"
                        title="Remover etapa">
                        <i className="ri-close-line text-base"></i>
                      </button>
                    )}
                  </div>

                  {/* Campo de descrição expansível */}
                  {isExpanded && (
                    <DescriptionField stageId={stage.id} value={stage.description || ''} bg="bg-gray-50" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Add stage */}
          <button onClick={addStage}
            className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm font-medium text-gray-400 hover:text-brand-600 hover:border-brand-300 hover:bg-brand-50/30 transition-all cursor-pointer">
            <i className="ri-add-line text-base"></i>
            Adicionar Etapa
          </button>
        </div>

        {/* ── Fixed stages ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <i className="ri-lock-line text-gray-400 text-sm"></i>
            <h4 className="text-sm font-semibold text-gray-800">Etapas Finais</h4>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">Fixas</span>
          </div>
          <div className="space-y-2">
            {[wonStage, lostStage].filter(Boolean).map(stage => {
              const isExpanded = expandedDesc === stage!.id;
              return (
                <div key={stage!.id} className="rounded-xl border border-gray-100 bg-gray-50/50 group">
                  <div className="flex items-center gap-3 p-3">
                    <div className="w-5 h-5 flex items-center justify-center text-gray-200">
                      <i className="ri-lock-line text-sm"></i>
                    </div>
                    <div className="w-7 h-7 rounded-lg flex-shrink-0 border-2 border-white shadow-sm" style={{ backgroundColor: stage!.color }}></div>
                    <input type="text" value={stage!.label}
                      onChange={e => updateStage(stage!.id, 'label', e.target.value)}
                      className="flex-1 text-sm font-medium text-gray-600 bg-transparent border-none outline-none focus:bg-white rounded-lg px-2 py-1 -mx-2 transition-colors" />
                    <button type="button"
                      onClick={() => setExpandedDesc(isExpanded ? null : stage!.id)}
                      title={isExpanded ? 'Ocultar descrição' : stage!.description ? 'Editar descrição' : 'Adicionar descrição'}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer flex-shrink-0
                        ${stage!.description
                          ? 'text-[#004aad] bg-[#004aad]/10'
                          : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100 opacity-0 group-hover:opacity-100'}`}>
                      <i className={`${isExpanded ? 'ri-chat-3-fill' : 'ri-chat-3-line'} text-sm`}></i>
                    </button>
                  </div>
                  {isExpanded && (
                    <DescriptionField stageId={stage!.id} value={stage!.description || ''} bg="bg-white" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Preview com tooltips ── */}
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Pré-visualização do Funil
          </p>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {editStages.map((stage, i) => (
              <div key={stage.id} className="flex items-center gap-1.5 flex-shrink-0">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-gray-100">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }}></div>
                  <span className="text-[11px] font-medium text-gray-600 whitespace-nowrap">
                    {stage.label || 'Sem nome'}
                  </span>
                  <StageTooltip label={stage.label || 'Sem nome'} description={stage.description} />
                </div>
                {i < editStages.length - 1 && (
                  <i className="ri-arrow-right-s-line text-gray-300 text-sm flex-shrink-0"></i>
                )}
              </div>
            ))}
          </div>
          {editStages.some(s => s.description) && (
            <p className="text-[10px] text-gray-400 mt-2.5 flex items-center gap-1">
              <i className="ri-information-line"></i>
              Passe o mouse sobre <i className="ri-information-line mx-0.5"></i> para ver a descrição de cada etapa
            </p>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={!hasChanges}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed">
            Salvar Configuração
          </button>
        </div>
      </div>
    </Modal>
  );
}
