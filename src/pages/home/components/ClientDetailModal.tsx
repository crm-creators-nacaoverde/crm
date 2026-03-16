import Modal from '../../../components/base/Modal';
import { Client } from '../../../lib/supabase';

interface ClientDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
}

const PLATFORM_ICON: Record<string, string> = {
  TikTok: 'ri-tiktok-line', Instagram: 'ri-instagram-line', YouTube: 'ri-youtube-line',
  Kwai: 'ri-play-circle-line', Facebook: 'ri-facebook-circle-line', 'Twitter/X': 'ri-twitter-x-line',
  Twitch: 'ri-twitch-line', Pinterest: 'ri-pinterest-line', LinkedIn: 'ri-linkedin-box-line', Outro: 'ri-global-line',
};
const PLATFORM_COLOR: Record<string, string> = {
  TikTok: 'from-gray-800 to-gray-900', Instagram: 'from-pink-500 to-purple-600',
  YouTube: 'from-red-500 to-red-700', Kwai: 'from-orange-400 to-orange-600',
  Facebook: 'from-blue-500 to-blue-700', 'Twitter/X': 'from-sky-400 to-sky-600',
  Twitch: 'from-purple-500 to-purple-700', Pinterest: 'from-rose-500 to-rose-700',
  LinkedIn: 'from-blue-600 to-blue-800', Outro: 'from-gray-400 to-gray-600',
};

export default function ClientDetailModal({ isOpen, onClose, client }: ClientDetailModalProps) {
  if (!client) return null;

  const formatCurrency = (val: number) =>
    `R$ ${Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const platform = client.platform || 'TikTok';
  const tiktokLinks = client.tiktok_links || [];
  const instagram = (client as any).instagram_profile as string | null;
  const youtube = (client as any).youtube_canal as string | null;

  const gmvData = [
    { label: '7 dias', value: client.gmv_interno_7d },
    { label: '14 dias', value: client.gmv_interno_14d },
    { label: '28 dias', value: client.gmv_interno_28d },
    { label: '30 dias', value: client.gmv_interno_30d },
  ];
  const videosData = [
    { label: '7d', value: client.videos_7d }, { label: '14d', value: client.videos_14d },
    { label: '28d', value: client.videos_28d }, { label: '30d', value: client.videos_30d },
  ];
  const livesData = [
    { label: '7d', value: client.lives_7d }, { label: '14d', value: client.lives_14d },
    { label: '28d', value: client.lives_28d }, { label: '30d', value: client.lives_30d },
  ];

  const maxVideos = Math.max(...videosData.map(v => Number(v.value || 0)), 1);
  const maxLives = Math.max(...livesData.map(v => Number(v.value || 0)), 1);

  const hasAddress = client.endereco_cep || client.endereco_rua || client.endereco_cidade;
  const hasPix = client.chave_pix;
  const hasSample = client.codigo_rastreio || client.amostra_enviada;
  const hasChannels = tiktokLinks.length > 0 || instagram || youtube;

  const fullAddress = [
    client.endereco_rua,
    client.endereco_numero ? `nº ${client.endereco_numero}` : '',
    client.endereco_complemento,
    client.endereco_bairro,
    client.endereco_cidade && client.endereco_estado
      ? `${client.endereco_cidade} - ${client.endereco_estado}`
      : client.endereco_cidade || client.endereco_estado,
    client.endereco_cep ? `CEP: ${client.endereco_cep}` : '',
  ].filter(Boolean).join(', ');

  const pixTipoLabel: Record<string, string> = {
    cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', telefone: 'Telefone', aleatoria: 'Chave Aleatória',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={client.name} subtitle="Detalhes do Creator" size="lg">
      <div className="space-y-6">

        {/* ── HEADER ── */}
        <div className="flex items-center gap-4 bg-gray-50 rounded-xl p-4">
          <div className={`w-14 h-14 bg-gradient-to-br ${PLATFORM_COLOR[platform] || 'from-[#5de0e6] to-[#004aad]'} rounded-xl flex items-center justify-center shadow-sm flex-shrink-0`}>
            <span className="text-white font-bold text-xl">{client.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900">{client.name}</h3>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="flex items-center gap-1.5 text-sm text-gray-500">
                <i className="ri-whatsapp-line text-emerald-500 text-sm"></i>
                {client.phone}
              </span>
              {client.cpf_cnpj && (
                <span className="flex items-center gap-1.5 text-sm text-gray-500">
                  <i className="ri-file-text-line text-gray-400 text-sm"></i>
                  <span className="font-mono text-xs">{client.cpf_cnpj}</span>
                </span>
              )}
              {/* Plataforma badge */}
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md text-white bg-gradient-to-r ${PLATFORM_COLOR[platform] || 'from-gray-500 to-gray-700'}`}>
                <i className={`${PLATFORM_ICON[platform] || 'ri-global-line'} text-xs`}></i>
                {platform}
              </span>
              {client.status === 'active' ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>Ativo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full"></span>Inativo
                </span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-gray-400">GMV Geral</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(client.gmv_geral)}</p>
          </div>
        </div>

        {/* ── CANAIS ── */}
        {hasChannels && (
          <div className="bg-gradient-to-r from-[#004aad]/5 to-[#5de0e6]/5 border border-[#5de0e6]/20 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <i className="ri-broadcast-line text-[#004aad]"></i>
              Canais do Creator
            </h4>
            <div className="flex flex-col gap-2">

              {/* TikTok */}
              {tiktokLinks.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <i className="ri-tiktok-line text-gray-800 text-sm"></i>TikTok
                    {tiktokLinks.length > 1 && <span className="text-gray-400 font-normal">({tiktokLinks.length} contas)</span>}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {tiktokLinks.map((link, i) => (
                      <a key={i} href={link} target="_blank" rel="nofollow noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 transition-all cursor-pointer max-w-xs"
                        onClick={e => e.stopPropagation()}>
                        <i className="ri-tiktok-line text-sm text-gray-800 flex-shrink-0"></i>
                        <span className="truncate">{link.replace(/^https?:\/\/(www\.)?tiktok\.com\//, '')}</span>
                        <i className="ri-external-link-line text-xs text-gray-400 flex-shrink-0"></i>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Instagram */}
              {instagram && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <i className="ri-instagram-line text-pink-500 text-sm"></i>Instagram
                  </p>
                  <a href={instagram} target="_blank" rel="nofollow noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-pink-50 border border-pink-100 rounded-lg text-sm text-gray-700 transition-all cursor-pointer max-w-xs"
                    onClick={e => e.stopPropagation()}>
                    <i className="ri-instagram-line text-sm text-pink-500 flex-shrink-0"></i>
                    <span className="truncate">{instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, '@')}</span>
                    <i className="ri-external-link-line text-xs text-gray-400 flex-shrink-0"></i>
                  </a>
                </div>
              )}

              {/* YouTube */}
              {youtube && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <i className="ri-youtube-line text-red-500 text-sm"></i>YouTube
                  </p>
                  <a href={youtube} target="_blank" rel="nofollow noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-red-50 border border-red-100 rounded-lg text-sm text-gray-700 transition-all cursor-pointer max-w-xs"
                    onClick={e => e.stopPropagation()}>
                    <i className="ri-youtube-line text-sm text-red-500 flex-shrink-0"></i>
                    <span className="truncate">{youtube.replace(/^https?:\/\/(www\.)?youtube\.com\//, '')}</span>
                    <i className="ri-external-link-line text-xs text-gray-400 flex-shrink-0"></i>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ENDEREÇO / PIX / AMOSTRA ── */}
        {(hasAddress || hasPix || hasSample) && (
          <div className="grid grid-cols-1 gap-4">
            {hasAddress && (
              <div className="bg-rose-50/40 border border-rose-100 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <i className="ri-map-pin-line text-rose-500"></i>Endereço
                </h4>
                <p className="text-sm text-gray-600">{fullAddress}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {hasPix && (
                <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <i className="ri-bank-card-line text-emerald-500"></i>Chave PIX
                  </h4>
                  {client.chave_pix_tipo && (
                    <p className="text-[11px] text-emerald-600 font-medium mb-1">
                      {pixTipoLabel[client.chave_pix_tipo] || client.chave_pix_tipo}
                    </p>
                  )}
                  <p className="text-sm text-gray-700 font-mono bg-white/60 px-2.5 py-1.5 rounded-lg border border-emerald-100 break-all">
                    {client.chave_pix}
                  </p>
                </div>
              )}
              {hasSample && (
                <div className={`border rounded-xl p-4 ${client.amostra_enviada ? 'bg-emerald-50/40 border-emerald-100' : 'bg-amber-50/40 border-amber-100'}`}>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <i className="ri-gift-line text-amber-500"></i>Amostra
                  </h4>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md ${client.amostra_enviada ? 'text-emerald-600 bg-emerald-100' : 'text-amber-600 bg-amber-100'}`}>
                      <i className={`text-xs ${client.amostra_enviada ? 'ri-check-line' : 'ri-time-line'}`}></i>
                      {client.amostra_enviada ? 'Enviada' : 'Pendente'}
                    </span>
                    {client.amostra_data_envio && (
                      <span className="text-[11px] text-gray-500">
                        em {new Date(client.amostra_data_envio).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                  {client.codigo_rastreio && (
                    <p className="text-xs text-gray-700 font-mono bg-white/60 px-2.5 py-1.5 rounded-lg border border-gray-200 break-all">
                      {client.codigo_rastreio}
                    </p>
                  )}
                  {client.amostra_observacao && (
                    <p className="text-xs text-gray-500 mt-2 italic">{client.amostra_observacao}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PRODUTOS ── */}
        {client.produtos_divulgados && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <i className="ri-shopping-bag-line text-brand-500"></i>Produtos Divulgados
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {client.produtos_divulgados.split(',').map((p, i) => (
                <span key={i} className="px-2.5 py-1 bg-brand-50 text-brand-700 text-xs font-medium rounded-md">
                  {p.trim()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── COMISSÃO ── */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Comissão Orgânica</p>
            <p className="text-2xl font-bold text-gray-900">{Number(client.comissao_organica || 0)}%</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Comissão Tráfego</p>
            <p className="text-2xl font-bold text-gray-900">{Number(client.comissao_trafego || 0)}%</p>
          </div>
        </div>

        {/* ── GMV INTERNO ── */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <i className="ri-money-dollar-circle-line text-emerald-500"></i>GMV Interno
          </h4>
          <div className="grid grid-cols-4 gap-3">
            {gmvData.map((item, i) => (
              <div key={i} className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 text-center">
                <p className="text-[11px] text-emerald-600 font-medium mb-1">{item.label}</p>
                <p className="text-sm font-bold text-gray-900">{formatCurrency(Number(item.value || 0))}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── VÍDEOS E LIVES ── */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <i className="ri-video-line text-brand-500"></i>Vídeos Feitos
            </h4>
            <div className="space-y-2">
              {videosData.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-8">{item.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-brand-400 to-brand-500 rounded-full flex items-center justify-end pr-2 transition-all"
                      style={{ width: `${Math.max((Number(item.value || 0) / maxVideos) * 100, 8)}%` }}>
                      <span className="text-[10px] font-bold text-white">{Number(item.value || 0)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <i className="ri-live-line text-rose-500"></i>Lives Feitas
            </h4>
            <div className="space-y-2">
              {livesData.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-8">{item.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full flex items-center justify-end pr-2 transition-all"
                      style={{ width: `${Math.max((Number(item.value || 0) / maxLives) * 100, 8)}%` }}>
                      <span className="text-[10px] font-bold text-white">{Number(item.value || 0)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* WhatsApp Group */}
        {client.whatsapp_group_link && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <i className="ri-whatsapp-line text-emerald-500"></i>Grupo do WhatsApp
            </h4>
            <a href={client.whatsapp_group_link} target="_blank" rel="nofollow noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-lg text-sm text-emerald-700 font-medium transition-all cursor-pointer">
              <i className="ri-external-link-line text-sm"></i>Abrir grupo
            </a>
          </div>
        )}
      </div>
    </Modal>
  );
}
