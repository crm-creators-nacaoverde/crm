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
  { key: 'cpf_cnpj',         label: 'CPF / CNPJ' },
  { key: 'instagram_profile',label: 'Instagram' },
  { key: 'youtube_canal',    label: 'YouTube' },
  { key: 'tiktok_main',      label: 'TikTok (canal principal)' },
  { key: 'platform',         label: 'Plataforma Principal' },
  { key: 'category',         label: 'Categoria' },
  { key: 'capture_source',   label: 'Fonte de Captação' },
  { key: 'status',           label: 'Status (active/inactive)' },
  { key: 'notes',            label: 'Observações' },
  
  // Endereço
  { key: 'endereco_cep',     label: 'CEP' },
  { key: 'endereco_rua',     label: 'Rua / Logradouro' },
  { key: 'endereco_numero',  label: 'Número' },
  { key: 'endereco_complemento', label: 'Complemento' },
  { key: 'endereco_bairro',  label: 'Bairro' },
  { key: 'endereco_cidade',  label: 'Cidade' },
  { key: 'endereco_estado',  label: 'Estado (UF)' },

  // Financeiro / PIX
  { key: 'chave_pix',        label: 'Chave PIX' },
  { key: 'chave_pix_tipo',   label: 'Tipo da Chave PIX' },
  { key: 'comissao_organica',label: 'Comissão Orgânica (%)' },
  { key: 'comissao_trafego', label: 'Comissão Tráfego (%)' },
  
  // Métricas / GMV
  { key: 'gmv_geral',        label: 'GMV Geral (R$)' },
  { key: 'gmv_interno_7d',   label: 'GMV Interno 7d (R$)' },
  { key: 'gmv_interno_14d',  label: 'GMV Interno 14d (R$)' },
  { key: 'gmv_interno_28d',  label: 'GMV Interno 28d (R$)' },
  { key: 'gmv_interno_30d',  label: 'GMV Interno 30d (R$)' },
  
  // Atividade
  { key: 'produtos_divulgados', label: 'Produtos Divulgados' },
  { key: 'whatsapp_group_link', label: 'Link Grupo WhatsApp' },
  { key: 'videos_7d',        label: 'Vídeos 7d' },
  { key: 'videos_14d',       label: 'Vídeos 14d' },
  { key: 'videos_28d',       label: 'Vídeos 28d' },
  { key: 'videos_30d',       label: 'Vídeos 30d' },
  { key: 'lives_7d',         label: 'Lives 7d' },
  { key: 'lives_14d',        label: 'Lives 14d' },
  { key: 'lives_28d',        label: 'Lives 28d' },
  { key: 'lives_30d',        label: 'Lives 30d' },

  // Amostra
  { key: 'codigo_rastreio',  label: 'Código de Rastreio' },
  { key: 'amostra_enviada',  label: 'Amostra Enviada (true/false)' },
  { key: 'amostra_data_envio', label: 'Data de Envio Amostra' },
  { key: 'amostra_observacao', label: 'Observação Amostra' },

  // Deal (Campos específicos para o negócio)
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
      else if (lower.includes('cep')) map[col] = 'endereco_cep';
      else if (lower.includes('rua') || lower.includes('logradouro')) map[col] = 'endereco_rua';
      else if (lower.includes('numero') || lower.includes('number')) map[col] = 'endereco_numero';
      else if (lower.includes('bairro')) map[col] = 'endereco_bairro';
      else if (lower.includes('cidade') || lower.includes('city')) map[col] = 'endereco_cidade';
      else if (lower.includes('estado') || lower.includes('uf')) map[col] = 'endereco_estado';
      else if (lower.includes('pix')) map[col] = 'chave_pix';
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

  const goToConfig = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, role')
      .eq('is_active', true)
      .order('full_name');
    setUsers(data || []);
    const def = funnels.find(f => f.is_default) || funnels[0];
    if (def) { setSelectedFunnelId(def.id); }
    setStep('config');
  };

  const missingRequired = () => {
    const mapped = Object.values(mapping);
    return !mapped.includes('name') || !mapped.includes('phone');
  };

  const countErrors = allRows.filter(row => {
    const nameCol = Object.entries(mapping).find(([, v]) => v === 'name')?.[0];
    const phoneCol = Object.entries(mapping).find(([, v]) => v === 'phone')?.[0];
    return !row[nameCol || '']?.trim() || !row[phoneCol || '']?.trim();
  }).length;
  const validRows = allRows.length - countErrors;

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
            if (field !== '__ignore__' && field !== 'name' && field !== 'phone' && !field.startsWith('deal_') && field !== 'tiktok_main') {
              const val = row[col]?.trim();
              if (val) {
                if (field.includes('gmv') || field.includes('comissao') || field.includes('videos') || field.includes('lives')) {
                  updateData[field] = parseFloat(val.replace(',', '.')) || 0;
                } else if (field === 'amostra_enviada') {
                  updateData[field] = val.toLowerCase() === 'true' || val === '1' || val.toLowerCase() === 'sim';
                } else {
                  updateData[field] = val;
                }
              }
            }
          });
          await supabase.from('clients').update(updateData).eq('id', existing.id);
          duplicates++;
          continue;
        }
      }

      // Montar client
      const clientData: Record<string, unknown> = {
        name, phone,
        created_by: user?.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
        followers: 0,
      };
      const tiktokLinks: string[] = [];
      Object.entries(mapping).forEach(([col, field]) => {
        if (field === '__ignore__' || field === 'name' || field === 'phone' || field.startsWith('deal_')) return;
        if (field === 'tiktok_main') { if (row[col]) tiktokLinks.push(row[col]); return; }
        
        const val = row[col]?.trim();
        if (val) {
          if (field.includes('gmv') || field.includes('comissao') || field.includes('videos') || field.includes('lives')) {
            clientData[field] = parseFloat(val.replace(',', '.')) || 0;
          } else if (field === 'amostra_enviada') {
            clientData[field] = val.toLowerCase() === 'true' || val === '1' || val.toLowerCase() === 'sim';
          } else {
            clientData[field] = val;
          }
        }
      });
      if (tiktokLinks.length > 0) clientData.tiktok_links = tiktokLinks;
      
      // Fallback para email se não mapeado
      if (!clientData.email) {
        clientData.email = name.toLowerCase().replace(/\s+/g, '.') + '@creator.com';
      }
      // Fallback para revenue se gmv_geral existir
      if (clientData.gmv_geral) {
        clientData.revenue = clientData.gmv_geral;
      }

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
        value: dealValueCol ? parseFloat(row[dealValueCol]?.replace(',', '.') || '0') || 0 : 0,
        description: dealDescCol ? row[dealDescCol] || null : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await supabase.from('deals').insert([dealData]);
      imported++;
    }

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
                className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer
                  ${dragOver ? 'border-[#5de0e6] bg-[#5de0e6]/5' : 'border-gray-200 hover:border-[#5de0e6]/50 hover:bg-gray-50'}`}
              >
                <input type="file" ref={fileRef} className="hidden" accept=".csv,.xlsx,.xls" onChange={e => e.target.files?.[0] && parseFile(e.target.files[0])} />
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <i className="ri-file-excel-2-line text-3xl text-gray-300"></i>
                </div>
                <p className="text-sm font-semibold text-gray-700">Arraste sua planilha ou clique para selecionar</p>
                <p className="text-xs text-gray-400 mt-1">Suporta arquivos .xlsx, .xls e .csv (UTF-8)</p>
              </div>

              {uploadError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-xs text-rose-600">
                  <i className="ri-error-warning-line text-sm"></i>
                  {uploadError}
                </div>
              )}

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <i className="ri-lightbulb-line"></i> Dicas para importação
                </h4>
                <ul className="space-y-1.5">
                  <li className="text-[11px] text-amber-700 flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 flex-shrink-0"></span>
                    Certifique-se que a primeira linha contém os nomes das colunas.
                  </li>
                  <li className="text-[11px] text-amber-700 flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 flex-shrink-0"></span>
                    Os campos <strong>Nome</strong> e <strong>WhatsApp</strong> são obrigatórios.
                  </li>
                  <li className="text-[11px] text-amber-700 flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 flex-shrink-0"></span>
                    Telefones devem incluir o DDD (ex: 11999999999).
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* ── STEP 2: MAPPING ── */}
          {step === 'mapping' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Relacione as colunas da sua planilha com os campos do CRM.</p>
                <span className="text-[10px] font-bold text-gray-400 uppercase bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                  {headers.length} colunas encontradas
                </span>
              </div>

              <div className="space-y-2">
                {headers.map(header => (
                  <div key={header} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 group hover:border-[#5de0e6]/30 transition-all">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-700 truncate">{header}</p>
                      <p className="text-[10px] text-gray-400 truncate mt-0.5 italic">Ex: {preview[0]?.[header] || '—'}</p>
                    </div>
                    <i className="ri-arrow-right-line text-gray-300"></i>
                    <div className="flex-1">
                      <select
                        value={mapping[header] || '__ignore__'}
                        onChange={e => setMapping({ ...mapping, [header]: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/20"
                      >
                        {SYSTEM_FIELDS.map(f => (
                          <option key={f.key} value={f.key}>
                            {f.label} {f.required ? '*' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              {preview.length > 0 && (
                <div className="mt-6">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Prévia dos dados (primeiras 5 linhas)</p>
                  <div className="overflow-x-auto border border-gray-100 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50/50">
                          {headers.map(h => (
                            <th key={h} className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">{h}</th>
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
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0 bg-gray-50/50">
          {step === 'upload' && (
            <>
              <button onClick={handleClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 cursor-pointer">Cancelar</button>
              <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                <i className="ri-lock-line"></i> Ambiente Seguro
              </div>
            </>
          )}

          {step === 'mapping' && (
            <>
              <button onClick={() => setStep('upload')} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 cursor-pointer">Voltar</button>
              <button
                onClick={goToConfig}
                disabled={missingRequired()}
                className="px-6 py-2 bg-[#004aad] text-white text-sm font-bold rounded-xl hover:bg-[#003d91] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#004aad]/20"
              >
                Continuar
              </button>
            </>
          )}

          {step === 'config' && (
            <>
              <button onClick={() => setStep('mapping')} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 cursor-pointer">Voltar</button>
              <button
                onClick={() => setStep('review')}
                disabled={!selectedFunnelId}
                className="px-6 py-2 bg-[#004aad] text-white text-sm font-bold rounded-xl hover:bg-[#003d91] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#004aad]/20"
              >
                Revisar Importação
              </button>
            </>
          )}

          {step === 'review' && (
            <>
              <button onClick={() => setStep('config')} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 cursor-pointer" disabled={importing}>Voltar</button>
              <button
                onClick={handleImport}
                disabled={importing || validRows === 0}
                className="px-8 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Importando...
                  </>
                ) : (
                  <>
                    <i className="ri-check-double-line text-lg"></i>
                    Confirmar e Importar
                  </>
                )}
              </button>
            </>
          )}

          {step === 'done' && (
            <button onClick={handleClose} className="w-full py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-black transition-all">
              Fechar Janela
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
