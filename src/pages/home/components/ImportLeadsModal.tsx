import { useState, useRef, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useFunnels } from '../../../hooks/useFunnels';
import { useFunnelStages } from '../../../hooks/useFunnelStages';
import { useActivityLog } from '../../../hooks/useActivityLog';

// ─── Tipos ────────────────────────────────────────────────────
interface UserOption {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

type DuplicateMode = 'ignore' | 'update' | 'allow';
type Step = 'upload' | 'mapping' | 'config' | 'review' | 'done';

// Campos do sistema disponíveis para mapeamento
const SYSTEM_FIELDS: { key: string; label: string; required?: boolean; hint?: string }[] = [
  { key: 'name',             label: 'Nome do Creator',   required: true },
  { key: 'phone',            label: 'WhatsApp / Telefone', required: true },
  { key: 'email',            label: 'E-mail' },
  { key: 'instagram_profile',label: 'Instagram' },
  { key: 'youtube_canal',    label: 'YouTube' },
  { key: 'tiktok_main',      label: 'TikTok (canal principal)' },
  { key: 'category',         label: 'Categoria' },
  { key: 'cpf_cnpj',         label: 'CPF / CNPJ' },
  { key: 'notes',            label: 'Observações' },
  { key: 'deal_value',       label: 'Valor do Deal (R$)' },
  { key: 'deal_description', label: 'Descrição do Deal' },
  { key: '__ignore__',       label: '— Ignorar campo —' },
];

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin', manager: 'Gerente', operator: 'Operador', viewer: 'Visualizador',
};
const ROLE_COLOR: Record<string, string> = {
  admin: 'text-amber-700 bg-amber-100',
  manager: 'text-sky-700 bg-sky-100',
  operator: 'text-emerald-700 bg-emerald-100',
  viewer: 'text-gray-500 bg-gray-100',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImported?: (count: number) => void;
}

export default function ImportLeadsModal({ isOpen, onClose, onImported }: Props) {
  const { user } = useAuth();
  const { logActivity } = useActivityLog();
  const { funnels } = useFunnels();

  // ── Estado de etapas ──────────────────────────────────────
  const [step, setStep] = useState<Step>('upload');

  // ── Upload ────────────────────────────────────────────────
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Mapeamento ────────────────────────────────────────────
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // ── Config ────────────────────────────────────────────────
  const [selectedFunnelId, setSelectedFunnelId] = useState('');
  const [selectedStageId, setSelectedStageId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [assignedName, setAssignedName] = useState('');
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('ignore');
  const [users, setUsers] = useState<UserOption[]>([]);
  const { stages } = useFunnelStages(selectedFunnelId || undefined);

  // ── Review / Import ───────────────────────────────────────
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; duplicates: number; errors: number } | null>(null);

  // ── Helpers ───────────────────────────────────────────────
  const reset = () => {
    setStep('upload');
    setFileName(''); setHeaders([]); setPreview([]); setAllRows([]);
    setMapping({}); setUploadError('');
    setSelectedFunnelId(''); setSelectedStageId('');
    setAssignedTo(''); setAssignedName('');
    setDuplicateMode('ignore'); setImportResult(null);
  };

  const handleClose = () => { reset(); onClose(); };

  // ── Leitura do arquivo ────────────────────────────────────
  // Parser CSV nativo — sem dependência externa
  const parseCSVText = (text: string): Record<string, string>[] => {
    const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const parseRow = (line: string): string[] => {
      const cells: string[] = [];
      let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; }
        else { cur += ch; }
      }
      cells.push(cur.trim());
      return cells;
    };
    const headers = parseRow(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
    return lines.slice(1).map(line => {
      const vals = parseRow(line).map(v => v.replace(/^"|"$/g, '').trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
      return row;
    }).filter(row => Object.values(row).some(v => v));
  };

  const autoDetect = (cols: string[]): Record<string, string> => {
    const map: Record<string, string> = {};
    cols.forEach(col => {
      const lower = col.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (lower.includes('nome') || lower.includes('name')) map[col] = 'name';
      else if (lower.includes('telefone') || lower.includes('phone') || lower.includes('whatsapp') || lower.includes('celular')) map[col] = 'phone';
      else if (lower.includes('email') || lower.includes('e-mail') || lower.includes('mail')) map[col] = 'email';
      else if (lower.includes('instagram') || lower.includes('insta')) map[col] = 'instagram_profile';
      else if (lower.includes('youtube') || lower.includes('yt')) map[col] = 'youtube_canal';
      else if (lower.includes('tiktok')) map[col] = 'tiktok_main';
      else if (lower.includes('categoria') || lower.includes('category')) map[col] = 'category';
      else if (lower.includes('cpf') || lower.includes('cnpj')) map[col] = 'cpf_cnpj';
      else if (lower.includes('obs') || lower.includes('note') || lower.includes('anotacao')) map[col] = 'notes';
      else map[col] = '__ignore__';
    });
    return map;
  };

  const applyRows = (json: Record<string, string>[]) => {
    if (json.length === 0) { setUploadError('A planilha está vazia.'); return; }
    if (json.length > 5000) { setUploadError('Limite de 5.000 linhas por importação.'); return; }
    const cols = Object.keys(json[0]);
    setHeaders(cols);
    setAllRows(json);
    setPreview(json.slice(0, 5));
    setMapping(autoDetect(cols));
    setStep('mapping');
  };

  const parseFile = useCallback((file: File) => {
    setUploadError('');
    const isCSV = file.name.match(/\.csv$/i);
    const isXLSX = file.name.match(/\.xlsx?$/i);
    if (!isCSV && !isXLSX) {
      setUploadError('Formato inválido. Use .xlsx, .xls ou .csv');
      return;
    }
    setFileName(file.name);

    if (isCSV) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target!.result as string;
          const json = parseCSVText(text);
          applyRows(json);
        } catch {
          setUploadError('Erro ao ler o CSV. Verifique o arquivo.');
        }
      };
      reader.readAsText(file, 'UTF-8');
      return;
    }

    // XLSX — carrega SheetJS via CDN dinâmico
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        // @ts-ignore
        if (!window.__XLSX__) {
          // @ts-ignore
          window.__XLSX__ = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
        }
        // @ts-ignore
        const XLSX = window.__XLSX__;
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        applyRows(json);
      } catch {
        setUploadError('Erro ao ler o Excel. Tente converter para CSV e importe novamente.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  // ── Carregar usuários ao ir para config ───────────────────
  const goToConfig = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, role')
      .eq('is_active', true)
      .order('full_name');
    setUsers(data || []);
    // Pré-selecionar o funil padrão
    const def = funnels.find(f => f.is_default) || funnels[0];
    if (def) { setSelectedFunnelId(def.id); }
    setStep('config');
  };

  // ── Validação do mapeamento ───────────────────────────────
  const missingRequired = () => {
    const mapped = Object.values(mapping);
    return !mapped.includes('name') || !mapped.includes('phone');
  };

  // ── Contagens para review ─────────────────────────────────
  const countErrors = allRows.filter(row => {
    const nameCol = Object.entries(mapping).find(([, v]) => v === 'name')?.[0];
    const phoneCol = Object.entries(mapping).find(([, v]) => v === 'phone')?.[0];
    return !row[nameCol || '']?.trim() || !row[phoneCol || '']?.trim();
  }).length;
  const validRows = allRows.length - countErrors;

  // ── Importar ──────────────────────────────────────────────
  const handleImport = async () => {
    setImporting(true);
    const nameCol  = Object.entries(mapping).find(([, v]) => v === 'name')?.[0] || '';
    const phoneCol = Object.entries(mapping).find(([, v]) => v === 'phone')?.[0] || '';
    const selectedFunnel = funnels.find(f => f.id === selectedFunnelId);
    const selectedStage  = stages.find(s => s.id === selectedStageId) || stages.find(s => s.id !== 'won' && s.id !== 'lost' && !s.id.startsWith('won_') && !s.id.startsWith('lost_'));

    let imported = 0, duplicates = 0, errors = 0;

    for (const row of allRows) {
      const name  = row[nameCol]?.trim();
      const phone = row[phoneCol]?.trim();
      if (!name || !phone) { errors++; continue; }

      // Verificar duplicata por telefone OU CPF/CNPJ
      const cpfCol = Object.entries(mapping).find(([, v]) => v === 'cpf_cnpj')?.[0] || '';
      const cpf = row[cpfCol]?.trim();

      let existing;
      if (phone) {
        const { data } = await supabase
          .from('clients')
          .select('id')
          .eq('phone', phone)
          .maybeSingle();
        existing = data;
      }

      if (!existing && cpf) {
        const { data } = await supabase
          .from('clients')
          .select('id')
          .eq('cpf_cnpj', cpf)
          .maybeSingle();
        existing = data;
      }

      if (existing) {
        if (duplicateMode === 'ignore') { duplicates++; continue; }
        if (duplicateMode === 'update') {
          const updateData: Record<string, unknown> = { name, updated_at: new Date().toISOString() };
          Object.entries(mapping).forEach(([col, field]) => {
            if (field !== '__ignore__' && field !== 'name' && field !== 'phone' && !field.startsWith('deal_') && field !== 'tiktok_main')
              updateData[field] = row[col] || null;
          });
          await supabase.from('clients').update(updateData).eq('id', existing.id);
          duplicates++;
          continue;
        }
        // 'allow' — cria mesmo assim (cai no insert abaixo)
      }

      // Montar client
      const clientData: Record<string, unknown> = {
        name, phone,
        created_by: user?.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const tiktokLinks: string[] = [];
      Object.entries(mapping).forEach(([col, field]) => {
        if (field === '__ignore__' || field === 'name' || field === 'phone' || field.startsWith('deal_')) return;
        if (field === 'tiktok_main') { if (row[col]) tiktokLinks.push(row[col]); return; }
        if (row[col]) clientData[field] = row[col];
      });
      if (tiktokLinks.length > 0) clientData.tiktok_links = tiktokLinks;

      const { data: newClient, error: clientErr } = await supabase
        .from('clients').insert([clientData]).select('id').single();
      if (clientErr || !newClient) { errors++; continue; }

      // Montar deal
      const dealValueCol  = Object.entries(mapping).find(([, v]) => v === 'deal_value')?.[0];
      const dealDescCol   = Object.entries(mapping).find(([, v]) => v === 'deal_description')?.[0];
      const dealData = {
        title: name,
        client_id: newClient.id,
        client_name: name,
        stage: selectedStage?.id || 'sem_contato',
        funnel_id: selectedFunnelId || null,
        assigned_to: assignedTo || null,
        assigned_name: assignedName || null,
        value: dealValueCol ? parseFloat(row[dealValueCol] || '0') || 0 : 0,
        description: dealDescCol ? row[dealDescCol] || null : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await supabase.from('deals').insert([dealData]);
      imported++;
    }

    // Registrar importação no log
    await supabase.from('lead_imports').insert([{
      created_by: user?.id,
      funnel_id: selectedFunnelId || null,
      funnel_name: selectedFunnel?.name || null,
      stage_id: selectedStage?.id || null,
      stage_label: selectedStage?.label || null,
      assigned_to: assignedTo || null,
      assigned_name: assignedName || null,
      duplicate_mode: duplicateMode,
      file_name: fileName,
      total_rows: allRows.length,
      imported, duplicates, errors,
      field_mapping: mapping,
      status: 'done',
    }]);

    await logActivity({
      action: 'create', module: 'imports',
      entityName: fileName,
      details: { imported, duplicates, errors, funnel: selectedFunnel?.name, assigned: assignedName, file: fileName },
    });
    setImportResult({ imported, duplicates, errors });
    setImporting(false);
    setStep('done');
    onImported?.(imported);
  };

  if (!isOpen) return null;

  // ── UI helpers ────────────────────────────────────────────
  const stepNum = { upload: 1, mapping: 2, config: 3, review: 4, done: 4 };
  const STEPS = ['Upload', 'Mapeamento', 'Configurar', 'Importar'];

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6] bg-white transition-all';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#5de0e6]/10 rounded-xl flex items-center justify-center">
              <i className="ri-upload-cloud-2-line text-[#004aad] text-lg"></i>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Importar Leads</h2>
              <p className="text-[11px] text-gray-400">Importe criadores via planilha Excel ou CSV</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 cursor-pointer">
            <i className="ri-close-line text-gray-400 text-lg"></i>
          </button>
        </div>

        {/* Progress steps */}
        {step !== 'done' && (
          <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-1">
              {STEPS.map((s, i) => {
                const current = stepNum[step];
                const done = i + 1 < current;
                const active = i + 1 === current;
                return (
                  <div key={s} className="flex items-center gap-1 flex-1 min-w-0">
                    <div className={`flex items-center gap-1.5 flex-shrink-0 ${active ? 'text-[#004aad]' : done ? 'text-emerald-600' : 'text-gray-300'}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0
                        ${active ? 'bg-[#004aad] text-white' : done ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                        {done ? <i className="ri-check-line text-[10px]"></i> : i + 1}
                      </div>
                      <span className={`text-xs font-medium whitespace-nowrap ${active ? 'text-[#004aad]' : done ? 'text-emerald-600' : 'text-gray-400'}`}>{s}</span>
                    </div>
                    {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-1 ${done ? 'bg-emerald-300' : 'bg-gray-100'}`}></div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── STEP 1: UPLOAD ── */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all
                  ${dragOver ? 'border-[#5de0e6] bg-[#5de0e6]/5' : 'border-gray-200 hover:border-[#5de0e6]/60 hover:bg-gray-50'}`}>
                <div className="w-14 h-14 bg-[#004aad]/10 rounded-2xl flex items-center justify-center">
                  <i className="ri-file-excel-2-line text-[#004aad] text-3xl"></i>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-800">Arraste seu arquivo aqui</p>
                  <p className="text-xs text-gray-400 mt-0.5">.xlsx, .xls ou .csv — máx. 5.000 linhas</p>
                </div>
                <span className="text-xs text-[#004aad] font-medium px-3 py-1.5 border border-[#004aad]/30 rounded-lg hover:bg-[#004aad]/5 transition-colors">
                  Selecionar arquivo
                </span>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => { if (e.target.files?.[0]) parseFile(e.target.files[0]); }} />

              {uploadError && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm text-rose-700">
                  <i className="ri-error-warning-line text-base flex-shrink-0"></i>{uploadError}
                </div>
              )}

              {/* Dica de formato */}
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dica de formato</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  A primeira linha deve ser o cabeçalho. Campos como <strong>Nome</strong> e <strong>Telefone</strong> são detectados automaticamente.
                  O sistema aceita qualquer nome de coluna e permite mapeamento manual na próxima etapa.
                </p>
              </div>
            </div>
          )}

          {/* ── STEP 2: MAPPING ── */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Mapeamento de campos</p>
                  <p className="text-xs text-gray-400 mt-0.5">{headers.length} colunas encontradas em <span className="font-medium text-gray-600">{fileName}</span></p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full">Nome *</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full">WhatsApp *</span>
                </div>
              </div>

              {/* Tabela de mapeamento */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-2 bg-gray-50 border-b border-gray-200 px-4 py-2">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Coluna da planilha</p>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Campo no sistema</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {headers.map(col => (
                    <div key={col} className="grid grid-cols-2 items-center px-4 py-2.5 hover:bg-gray-50/50 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-gray-800 truncate">{col}</p>
                        <p className="text-[11px] text-gray-400 truncate">{preview[0]?.[col] || '—'}</p>
                      </div>
                      <select
                        value={mapping[col] || '__ignore__'}
                        onChange={e => setMapping(prev => ({ ...prev, [col]: e.target.value }))}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6] cursor-pointer w-full">
                        {SYSTEM_FIELDS.map(f => (
                          <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {preview.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Preview — primeiras {preview.length} linhas</p>
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          {headers.map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {preview.map((row, i) => (
                          <tr key={i}>
                            {headers.map(h => (
                              <td key={h} className="px-3 py-1.5 text-gray-600 whitespace-nowrap truncate max-w-[120px]">{row[h] || '—'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {missingRequired() && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
                  <i className="ri-alert-line text-sm flex-shrink-0"></i>
                  Mapeie os campos obrigatórios <strong>Nome</strong> e <strong>WhatsApp</strong> para continuar.
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: CONFIG ── */}
          {step === 'config' && (
            <div className="space-y-5">
              <p className="text-sm text-gray-500">Configure onde os leads serão inseridos e quem ficará responsável por eles.</p>

              {/* Funil e etapa */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Funil de destino</label>
                  <select value={selectedFunnelId} onChange={e => { setSelectedFunnelId(e.target.value); setSelectedStageId(''); }} className={inp}>
                    <option value="">Selecione o funil</option>
                    {funnels.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Etapa inicial</label>
                  <select value={selectedStageId} onChange={e => setSelectedStageId(e.target.value)} className={inp} disabled={!selectedFunnelId}>
                    <option value="">Primeira etapa disponível</option>
                    {stages.filter(s => s.id !== 'won' && s.id !== 'lost').map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Responsável — SOMENTE usuários do sistema */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Responsável pelos leads
                </label>
                <div className="p-3 bg-[#5de0e6]/5 border border-[#5de0e6]/20 rounded-xl mb-2">
                  <div className="flex items-start gap-2">
                    <i className="ri-shield-user-line text-[#004aad] text-sm mt-0.5 flex-shrink-0"></i>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      O responsável é sempre um <strong>usuário do sistema</strong>. Ele ficará vinculado a todos os deals importados e receberá notificações conforme as automações do funil.
                    </p>
                  </div>
                </div>

                {/* Sem responsável */}
                <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all mb-1.5
                  ${!assignedTo ? 'border-gray-300 bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                    ${!assignedTo ? 'border-[#004aad] bg-[#004aad]' : 'border-gray-300'}`}>
                    {!assignedTo && <span className="w-2 h-2 bg-white rounded-full"></span>}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Sem responsável definido</p>
                    <p className="text-[11px] text-gray-400">Os deals ficarão sem responsável até atribuição manual</p>
                  </div>
                  <input type="radio" className="sr-only" checked={!assignedTo} onChange={() => { setAssignedTo(''); setAssignedName(''); }} />
                </label>

                {/* Lista de usuários */}
                <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                  {users.map(u => {
                    const sel = assignedTo === u.id;
                    return (
                      <label key={u.id}
                        className={`flex items-center gap-3 p-2.5 rounded-xl border-2 cursor-pointer transition-all
                          ${sel ? 'border-[#004aad]/30 bg-[#004aad]/5' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                          ${sel ? 'border-[#004aad] bg-[#004aad]' : 'border-gray-300'}`}>
                          {sel && <span className="w-2 h-2 bg-white rounded-full"></span>}
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5de0e6] to-[#004aad] flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-[11px] font-bold">{u.full_name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{u.full_name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${ROLE_COLOR[u.role] || 'text-gray-500 bg-gray-100'}`}>
                          {ROLE_LABEL[u.role] || u.role}
                        </span>
                        <input type="radio" className="sr-only" checked={sel}
                          onChange={() => { setAssignedTo(u.id); setAssignedName(u.full_name); }} />
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Duplicatas */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Comportamento com duplicatas</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'ignore', label: 'Ignorar',    icon: 'ri-skip-forward-line',  desc: 'Pula linhas com telefone ou CPF já cadastrado' },
                    { id: 'update', label: 'Atualizar',  icon: 'ri-refresh-line',        desc: 'Atualiza o creator existente com os novos dados' },
                    { id: 'allow',  label: 'Permitir',   icon: 'ri-add-circle-line',     desc: 'Cria mesmo que o contato já exista' },
                  ] as const).map(opt => (
                    <button key={opt.id} type="button"
                      onClick={() => setDuplicateMode(opt.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer
                        ${duplicateMode === opt.id ? 'border-[#004aad]/40 bg-[#004aad]/5' : 'border-gray-100 hover:border-gray-200'}`}>
                      <i className={`${opt.icon} text-base ${duplicateMode === opt.id ? 'text-[#004aad]' : 'text-gray-400'} block mb-1`}></i>
                      <p className={`text-xs font-semibold ${duplicateMode === opt.id ? 'text-[#004aad]' : 'text-gray-700'}`}>{opt.label}</p>
                      <p className="text-[10px] text-gray-400 leading-relaxed mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 4: REVIEW ── */}
          {step === 'review' && (
            <div className="space-y-5">
              <p className="text-sm text-gray-500">Revise o resumo antes de confirmar a importação.</p>

              {/* Resumo contagens */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{validRows}</p>
                  <p className="text-[11px] text-emerald-600 font-medium mt-0.5">leads para importar</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 text-center">
                  <p className="text-2xl font-bold text-amber-700">—</p>
                  <p className="text-[11px] text-amber-600 font-medium mt-0.5">duplicatas detectadas</p>
                  <p className="text-[10px] text-amber-500">verificado durante import</p>
                </div>
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3.5 text-center">
                  <p className="text-2xl font-bold text-rose-700">{countErrors}</p>
                  <p className="text-[11px] text-rose-600 font-medium mt-0.5">sem nome/telefone</p>
                </div>
              </div>

              {/* Destino */}
              <div className="bg-gray-50 rounded-xl border border-gray-100 divide-y divide-gray-100">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-gray-500">Arquivo</span>
                  <span className="text-xs font-semibold text-gray-800">{fileName}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-gray-500">Funil</span>
                  <span className="text-xs font-semibold text-gray-800">{funnels.find(f => f.id === selectedFunnelId)?.name || '—'}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-gray-500">Etapa inicial</span>
                  <span className="text-xs font-semibold text-gray-800">
                    {stages.find(s => s.id === selectedStageId)?.label || stages.find(s => s.id !== 'won' && s.id !== 'lost')?.label || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-gray-500">Responsável</span>
                  <span className="text-xs font-semibold text-gray-800">{assignedName || 'Sem responsável'}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-gray-500">Duplicatas</span>
                  <span className="text-xs font-semibold text-gray-800 capitalize">{duplicateMode === 'ignore' ? 'Ignorar' : duplicateMode === 'update' ? 'Atualizar' : 'Permitir'}</span>
                </div>
              </div>

              {validRows === 0 && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700">
                  <i className="ri-error-warning-line text-sm flex-shrink-0"></i>
                  Não há linhas válidas para importar. Verifique o mapeamento ou o arquivo.
                </div>
              )}
            </div>
          )}

          {/* ── STEP DONE ── */}
          {step === 'done' && importResult && (
            <div className="py-6 text-center space-y-5">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto">
                <i className="ri-checkbox-circle-fill text-emerald-500 text-4xl"></i>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">Importação concluída!</p>
                <p className="text-sm text-gray-500 mt-1">{fileName}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-emerald-700">{importResult.imported}</p>
                  <p className="text-[11px] text-emerald-600">importados</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-amber-700">{importResult.duplicates}</p>
                  <p className="text-[11px] text-amber-600">duplicatas</p>
                </div>
                <div className="bg-rose-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-rose-700">{importResult.errors}</p>
                  <p className="text-[11px] text-rose-600">erros</p>
                </div>
              </div>
              <button onClick={handleClose}
                className="px-6 py-2.5 bg-[#004aad] text-white text-sm font-semibold rounded-xl hover:bg-[#003d91] transition-colors cursor-pointer">
                Fechar
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'done' && (
          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
            {step !== 'upload' && (
              <button
                onClick={() => {
                  if (step === 'mapping') setStep('upload');
                  if (step === 'config')  setStep('mapping');
                  if (step === 'review')  setStep('config');
                }}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer">
                ← Voltar
              </button>
            )}
            <button onClick={handleClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer">
              Cancelar
            </button>
            <div className="flex-1"></div>

            {step === 'upload' && (
              <button disabled className="px-5 py-2.5 text-sm font-semibold text-white bg-gray-200 rounded-xl cursor-not-allowed opacity-50">
                Próximo →
              </button>
            )}
            {step === 'mapping' && (
              <button onClick={goToConfig} disabled={missingRequired()}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-[#004aad] hover:bg-[#003d91] rounded-xl transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                Próximo →
              </button>
            )}
            {step === 'config' && (
              <button onClick={() => setStep('review')} disabled={!selectedFunnelId}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-[#004aad] hover:bg-[#003d91] rounded-xl transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                Revisar →
              </button>
            )}
            {step === 'review' && (
              <button onClick={handleImport} disabled={importing || validRows === 0}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-[#004aad] hover:bg-[#003d91] rounded-xl transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                {importing
                  ? <><i className="ri-loader-4-line animate-spin"></i>Importando...</>
                  : <><i className="ri-download-cloud-line"></i>Importar {validRows} leads</>}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
