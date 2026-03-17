import { useState, useEffect } from 'react';
import { supabase, Client } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useActivityLog } from '../../../hooks/useActivityLog';
import Button from '../../../components/base/Button';
import ClientModal from './ClientModal';
import ClientDetailModal from './ClientDetailModal';
import SendFormWhatsAppModal from '../../creators/components/SendFormWhatsAppModal';
import ImportLeadsModal from './ImportLeadsModal';

const PLATFORM_ICON: Record<string, string> = {
  TikTok:     'ri-tiktok-line',
  Instagram:  'ri-instagram-line',
  YouTube:    'ri-youtube-line',
  Kwai:       'ri-play-circle-line',
  Facebook:   'ri-facebook-circle-line',
  'Twitter/X':'ri-twitter-x-line',
  Twitch:     'ri-twitch-line',
  Pinterest:  'ri-pinterest-line',
  LinkedIn:   'ri-linkedin-box-line',
  Outro:      'ri-global-line',
};

const PLATFORM_COLOR: Record<string, string> = {
  TikTok:     'text-gray-900 bg-gray-100',
  Instagram:  'text-pink-600 bg-pink-50',
  YouTube:    'text-red-600 bg-red-50',
  Kwai:       'text-orange-600 bg-orange-50',
  Facebook:   'text-blue-600 bg-blue-50',
  'Twitter/X':'text-sky-600 bg-sky-50',
  Twitch:     'text-purple-600 bg-purple-50',
  Pinterest:  'text-rose-600 bg-rose-50',
  LinkedIn:   'text-blue-700 bg-blue-50',
  Outro:      'text-gray-500 bg-gray-50',
};

export default function ClientsSection() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [sendFormClient, setSendFormClient] = useState<Client | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const { user, hasPermission } = useAuth();
  const { logActivity } = useActivityLog();

  const canEdit = hasPermission('clients', 'edit');
  const canDelete = hasPermission('clients', 'delete');

  useEffect(() => { loadClients(); }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Erro ao carregar creators:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch =
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.phone || '').includes(searchTerm) ||
      (client.produtos_divulgados || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || client.status === filterStatus;
    const matchesPlatform = filterPlatform === 'all' || (client.platform || 'TikTok') === filterPlatform;
    const matchesCategory = filterCategory === 'all' || (client.category || 'Creators') === filterCategory;
    return matchesSearch && matchesStatus && matchesPlatform && matchesCategory;
  });

  const handleAddClient = () => { setSelectedClient(null); setIsModalOpen(true); };
  const handleEditClient = (client: Client) => { setSelectedClient(client); setIsModalOpen(true); };
  const handleViewClient = (client: Client) => { setSelectedClient(client); setIsDetailOpen(true); };

  const handleSave = async (data: Record<string, unknown>) => {
    try {
      const payload = { ...data, updated_at: new Date().toISOString() };
      if (selectedClient) {
        const { error } = await supabase.from('clients').update(payload).eq('id', selectedClient.id);
        if (error) throw error;
        await logActivity({ action: 'update', module: 'creators', entityId: selectedClient.id, entityName: selectedClient.name, details: { before: selectedClient, after: { ...selectedClient, ...payload } } });
        showToast('Creator atualizado com sucesso!');
      } else {
        const { data: newClient, error } = await supabase.from('clients').insert([{ ...payload, created_by: user?.id }]).select().single();
        if (error) throw error;
        await logActivity({ action: 'create', module: 'creators', entityId: newClient.id, entityName: (payload.name as string) || 'Novo creator', details: { data: payload } });
        showToast('Creator cadastrado com sucesso!');
      }
      await loadClients();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Erro ao salvar creator:', error);
      showToast('Erro ao salvar. Tente novamente.', 'error');
    }
  };

  const handleDeleteClient = async (id: string) => {
    try {
      const clientToDelete = clients.find(c => c.id === id);
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      if (clientToDelete) {
        await logActivity({ action: 'delete', module: 'creators', entityId: id, entityName: clientToDelete.name, details: { deletedData: clientToDelete } });
      }
      await loadClients();
      setDeleteConfirm(null);
      showToast('Creator removido com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir creator:', error);
      showToast('Erro ao excluir. Tente novamente.', 'error');
    }
  };

  const activeCount = clients.filter(c => c.status === 'active').length;
  const totalGmv = clients.reduce((sum, c) => sum + Number(c.gmv_geral || 0), 0);
  const totalVideos = clients.reduce((sum, c) => sum + Number(c.videos_30d || 0), 0);

  const formatCurrency = (val: number) =>
    `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  // Plataformas e categorias únicas dos creators cadastrados
  const platformsInUse = Array.from(new Set(clients.map(c => c.platform || 'TikTok'))).sort();
  const categoriesInUse = Array.from(new Set(clients.map(c => c.category || 'Creators'))).sort();

  const CATEGORY_COLOR: Record<string, string> = {
    Creators: 'text-[#004aad] bg-[#004aad]/10',
    Embaixadores: 'text-amber-700 bg-amber-50',
    Influenciadores: 'text-purple-700 bg-purple-50',
    Parceiros: 'text-emerald-700 bg-emerald-50',
    Afiliados: 'text-rose-700 bg-rose-50',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-3 border-[#5de0e6] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-[#5de0e6]/10 rounded-xl flex items-center justify-center">
            <i className="ri-user-star-line text-lg text-[#004aad]"></i>
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{clients.length}</p>
            <p className="text-xs text-gray-400">Total de Creators</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
            <i className="ri-checkbox-circle-line text-lg text-emerald-600"></i>
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{activeCount}</p>
            <p className="text-xs text-gray-400">Ativos</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
            <i className="ri-money-dollar-circle-line text-lg text-amber-600"></i>
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalGmv)}</p>
            <p className="text-xs text-gray-400">GMV Total</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
            <i className="ri-video-line text-lg text-rose-600"></i>
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{totalVideos}</p>
            <p className="text-xs text-gray-400">Vídeos (30d)</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Busca */}
          <div className="relative flex-1 w-full">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-gray-50/50"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {/* Filtro Status */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              {[{ value: 'all', label: 'Todos' }, { value: 'active', label: 'Ativos' }, { value: 'inactive', label: 'Inativos' }].map(s => (
                <button key={s.value} onClick={() => setFilterStatus(s.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap cursor-pointer transition-all ${filterStatus === s.value ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  {s.label}
                </button>
              ))}
            </div>

            {/* Filtro Plataforma */}
            {platformsInUse.length > 1 && (
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => setFilterPlatform('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-all whitespace-nowrap ${filterPlatform === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  Todas
                </button>
                {platformsInUse.map(p => (
                  <button key={p} onClick={() => setFilterPlatform(p)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-all flex items-center gap-1.5 whitespace-nowrap ${filterPlatform === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                    <i className={`${PLATFORM_ICON[p] || 'ri-global-line'} text-sm`}></i>
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Filtro Categoria */}
            {categoriesInUse.length > 1 && (
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => setFilterCategory('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-all whitespace-nowrap ${filterCategory === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  Categ.
                </button>
                {categoriesInUse.map(cat => (
                  <button key={cat} onClick={() => setFilterCategory(cat)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-all whitespace-nowrap ${filterCategory === cat ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {canEdit && (
              <button
                onClick={() => setIsImportOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer">
                <i className="ri-file-excel-2-line text-sm text-emerald-600"></i>
                <span className="hidden sm:inline">Importar</span>
              </button>
            )}
            {canEdit && (
              <Button onClick={handleAddClient} size="md">
                <i className="ri-add-line text-sm"></i>
                <span className="hidden sm:inline">Novo Creator</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Creator</th>
                <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Categoria</th>
                <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Canais</th>
                <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">GMV Geral</th>
                <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Produtos</th>
                <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Comissão</th>
                <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Vídeos / Lives</th>
                <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Amostra</th>
                {(canEdit || canDelete) && (
                  <th className="text-right py-3.5 px-5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Ações</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => {
                const platform = client.platform || 'TikTok';
                const tiktokLinks = client.tiktok_links || [];
                const instagram = (client as any).instagram_profile;
                const youtube = (client as any).youtube_canal;
                const channelCount =
                  (tiktokLinks.length > 0 ? 1 : 0) +
                  (instagram ? 1 : 0) +
                  (youtube ? 1 : 0);

                return (
                  <tr
                    key={client.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group cursor-pointer"
                    onClick={() => handleViewClient(client)}
                  >
                    {/* Creator */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-[#5de0e6] to-[#004aad] rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                          <span className="text-white font-semibold text-xs">
                            {client.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{client.name}</p>
                          <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                            <i className="ri-whatsapp-line text-emerald-500 text-[10px]"></i>
                            {client.phone}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Categoria */}
                    <td className="py-3.5 px-5">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold ${CATEGORY_COLOR[client.category || 'Creators'] || 'text-gray-600 bg-gray-100'}`}>
                        <i className="ri-medal-line text-xs"></i>
                        {client.category || 'Creators'}
                      </span>
                    </td>

                    {/* ── CANAIS ── */}
                    <td className="py-3.5 px-5">
                      <div className="flex flex-col gap-1.5 min-w-[120px]">
                        {/* Plataforma principal badge */}
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold w-fit ${PLATFORM_COLOR[platform] || 'text-gray-500 bg-gray-50'}`}>
                          <i className={`${PLATFORM_ICON[platform] || 'ri-global-line'} text-xs`}></i>
                          {platform}
                        </span>

                        {/* Ícones de canais extras */}
                        {channelCount > 0 && (
                          <div className="flex items-center gap-1">
                            {tiktokLinks.length > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
                                <i className="ri-tiktok-line text-xs text-gray-800"></i>
                                {tiktokLinks.length > 1 && <span className="font-medium">{tiktokLinks.length}</span>}
                              </span>
                            )}
                            {instagram && (
                              <span className="flex items-center text-[10px] text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded">
                                <i className="ri-instagram-line text-xs"></i>
                              </span>
                            )}
                            {youtube && (
                              <span className="flex items-center text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                                <i className="ri-youtube-line text-xs"></i>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* GMV */}
                    <td className="py-3.5 px-5">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(Number(client.gmv_geral || 0))}
                      </span>
                    </td>

                    {/* Produtos */}
                    <td className="py-3.5 px-5">
                      <div className="flex flex-wrap gap-1 max-w-[160px]">
                        {(client.produtos_divulgados || '').split(',').slice(0, 2).filter(p => p.trim()).map((p, i) => (
                          <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] font-medium rounded-md truncate max-w-[80px]">
                            {p.trim()}
                          </span>
                        ))}
                        {(client.produtos_divulgados || '').split(',').filter(p => p.trim()).length > 2 && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-400 text-[11px] rounded-md">
                            +{(client.produtos_divulgados || '').split(',').filter(p => p.trim()).length - 2}
                          </span>
                        )}
                        {!client.produtos_divulgados && <span className="text-xs text-gray-300 italic">—</span>}
                      </div>
                    </td>

                    {/* Comissão */}
                    <td className="py-3.5 px-5">
                      <div className="text-sm text-gray-600 whitespace-nowrap">
                        <span className="text-xs text-gray-400">Org:</span> {Number(client.comissao_organica || 0)}%
                        <span className="text-gray-300 mx-1">|</span>
                        <span className="text-xs text-gray-400">Trf:</span> {Number(client.comissao_trafego || 0)}%
                      </div>
                    </td>

                    {/* Vídeos / Lives */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <i className="ri-video-line text-xs text-brand-500"></i>
                          {Number(client.videos_30d || 0)}
                        </span>
                        <span className="flex items-center gap-1">
                          <i className="ri-live-line text-xs text-rose-500"></i>
                          {Number(client.lives_30d || 0)}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-5">
                      {client.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400">
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full"></span>Inativo
                        </span>
                      )}
                    </td>

                    {/* Amostra */}
                    <td className="py-3.5 px-5">
                      {client.amostra_enviada ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg w-fit">
                            <i className="ri-check-double-line text-sm"></i>Enviada
                          </span>
                          {client.amostra_data_envio && (
                            <span className="text-[10px] text-gray-400 pl-0.5">
                              {new Date(client.amostra_data_envio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                            </span>
                          )}
                        </div>
                      ) : client.codigo_rastreio ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg w-fit">
                            <i className="ri-truck-line text-sm"></i>Em trânsito
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono pl-0.5 truncate max-w-[100px]" title={client.codigo_rastreio}>
                            {client.codigo_rastreio}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg w-fit">
                          <i className="ri-close-circle-line text-sm"></i>Não enviada
                        </span>
                      )}
                    </td>

                    {/* Ações */}
                    {(canEdit || canDelete) && (
                      <td className="py-3.5 px-5">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {canEdit && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setSendFormClient(client); }}
                              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                              title="Enviar formulário via WhatsApp"
                            >
                              <i className="ri-send-plane-line text-sm"></i>
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEditClient(client); }}
                              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all cursor-pointer"
                              title="Editar"
                            >
                              <i className="ri-edit-line text-sm"></i>
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirm(client.id); }}
                              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                              title="Excluir"
                            >
                              <i className="ri-delete-bin-line text-sm"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredClients.length === 0 && (
          <div className="text-center py-16">
            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <i className="ri-user-search-line text-2xl text-gray-300"></i>
            </div>
            <p className="text-sm font-medium text-gray-400">Nenhum creator encontrado</p>
            <p className="text-xs text-gray-300 mt-1">Tente ajustar os filtros ou adicionar um novo creator</p>
          </div>
        )}
      </div>

      {/* Modais */}
      <ClientModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} client={selectedClient} onSave={handleSave} />
      <ClientDetailModal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} client={selectedClient} />
      <SendFormWhatsAppModal isOpen={!!sendFormClient} onClose={() => setSendFormClient(null)} client={sendFormClient} />
      <ImportLeadsModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImported={() => { setIsImportOpen(false); loadClients(); }}
      />

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-[fadeIn_0.2s_ease-out]">
            <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-delete-bin-line text-2xl text-rose-500"></i>
            </div>
            <h3 className="text-base font-semibold text-gray-900 text-center mb-1">Excluir Creator</h3>
            <p className="text-sm text-gray-500 text-center mb-5">Tem certeza? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button onClick={() => handleDeleteClient(deleteConfirm)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors cursor-pointer">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-[fadeIn_0.2s_ease-out]">
          <div className="flex items-center gap-3 bg-gray-900 text-white px-5 py-3.5 rounded-xl shadow-2xl">
            <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${toast.type === 'success' ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
              <i className={`text-lg ${toast.type === 'success' ? 'ri-check-line text-emerald-400' : 'ri-close-line text-rose-400'}`}></i>
            </div>
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
