import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface UserStats {
  userId: string;
  userName: string;
  inbound: number;
  outbound: number;
  won: number;
  lost: number;
  avgResponseTime: number; // em minutos
}

interface WhatsAppStats {
  totalConversations: number;
  totalMessages: number;
  inboundCount: number;
  outboundCount: number;
  newConversations: number;
  oldConversations: number;
  byStatus: Record<string, number>;
  avgResponseTimeGlobal: number;
  userStats: UserStats[];
}

interface Props {
  period?: '7d' | '14d' | '28d' | '30d';
}

export default function WhatsAppWidget({ period = '30d' }: Props) {
  const [stats, setStats] = useState<WhatsAppStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWhatsApp = async () => {
      setLoading(true);
      
      const days = parseInt(period.replace('d', ''));
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateIso = startDate.toISOString();

      // 1. Buscar conversas no período
      const { data: conversations } = await supabase
        .from('wa_conversations')
        .select('*')
        .gte('updated_at', startDateIso);

      // 2. Buscar mensagens no período
      const { data: messages } = await supabase
        .from('wa_messages')
        .select('*')
        .gte('created_at', startDateIso);

      // 3. Buscar usuários para o comparativo
      const { data: users } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .eq('is_active', true);

      if (conversations && messages && users) {
        const inboundCount = messages.filter(m => m.direction === 'inbound').length;
        const outboundCount = messages.filter(m => m.direction === 'outbound').length;
        
        const byStatus: Record<string, number> = {};
        conversations.forEach(c => {
          byStatus[c.status] = (byStatus[c.status] || 0) + 1;
        });

        // Novas vs Antigas (baseado no created_at dentro do período selecionado)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const newConversations = conversations.filter(c => new Date(c.created_at) >= sevenDaysAgo).length;
        const oldConversations = conversations.length - newConversations;

        // Cálculo de métricas por usuário
        const userStatsMap: Record<string, UserStats> = {};
        users.forEach(u => {
          userStatsMap[u.id] = {
            userId: u.id,
            userName: u.full_name,
            inbound: 0,
            outbound: 0,
            won: 0,
            lost: 0,
            avgResponseTime: 0
          };
        });

        // Inbound/Outbound por usuário (baseado em quem enviou a mensagem ou a quem a conversa está atribuída)
        messages.forEach(m => {
          if (m.direction === 'outbound' && m.sent_by && userStatsMap[m.sent_by]) {
            userStatsMap[m.sent_by].outbound++;
          }
        });

        // Ganho/Perdido por usuário
        conversations.forEach(c => {
          if (c.assigned_to && userStatsMap[c.assigned_to]) {
            if (c.status === 'closed') {
              if (c.outcome === 'won') userStatsMap[c.assigned_to].won++;
              if (c.outcome === 'lost') userStatsMap[c.assigned_to].lost++;
            }
            // Contar inbound para o usuário atribuído (simplificação: se a conversa recebeu msg inbound e está com ele)
            const convMessages = messages.filter(m => m.conversation_id === c.id);
            userStatsMap[c.assigned_to].inbound += convMessages.filter(m => m.direction === 'inbound').length;
          }
        });

        // Tempo médio de atendimento (Simplificado: diferença entre a primeira mensagem inbound e a atribuição/primeira resposta)
        // Nota: Para um cálculo preciso, precisaríamos de logs de atribuição. 
        // Vamos usar a diferença entre created_at da conversa (chegada do lead) e a primeira mensagem outbound.
        let totalResponseTime = 0;
        let responseCount = 0;

        const userResponseTimes: Record<string, { total: number, count: number }> = {};

        conversations.forEach(c => {
          const firstInbound = messages
            .filter(m => m.conversation_id === c.id && m.direction === 'inbound')
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
          
          const firstOutbound = messages
            .filter(m => m.conversation_id === c.id && m.direction === 'outbound')
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];

          if (firstInbound && firstOutbound) {
            const diff = (new Date(firstOutbound.created_at).getTime() - new Date(firstInbound.created_at).getTime()) / (1000 * 60);
            if (diff > 0 && diff < 1440) { // Limitar a 24h para evitar outliers de conversas antigas
              totalResponseTime += diff;
              responseCount++;

              if (firstOutbound.sent_by && userStatsMap[firstOutbound.sent_by]) {
                if (!userResponseTimes[firstOutbound.sent_by]) userResponseTimes[firstOutbound.sent_by] = { total: 0, count: 0 };
                userResponseTimes[firstOutbound.sent_by].total += diff;
                userResponseTimes[firstOutbound.sent_by].count++;
              }
            }
          }
        });

        Object.keys(userResponseTimes).forEach(uid => {
          if (userStatsMap[uid]) {
            userStatsMap[uid].avgResponseTime = userResponseTimes[uid].total / userResponseTimes[uid].count;
          }
        });

        const finalUserStats = Object.values(userStatsMap)
          .filter(u => u.inbound > 0 || u.outbound > 0 || u.won > 0 || u.lost > 0)
          .sort((a, b) => (b.won + b.outbound) - (a.won + a.outbound));

        setStats({
          totalConversations: conversations.length,
          totalMessages: messages.length,
          inboundCount,
          outboundCount,
          newConversations,
          oldConversations,
          byStatus,
          avgResponseTimeGlobal: responseCount > 0 ? totalResponseTime / responseCount : 0,
          userStats: finalUserStats
        });
      }
      setLoading(false);
    };

    fetchWhatsApp();
  }, [period]);

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 h-full flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#5de0e6] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!stats) return null;

  const inboundPct = stats.totalMessages > 0 ? (stats.inboundCount / stats.totalMessages) * 100 : 0;
  const outboundPct = stats.totalMessages > 0 ? (stats.outboundCount / stats.totalMessages) * 100 : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 h-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
            <i className="ri-whatsapp-line text-base text-emerald-600"></i>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">WhatsApp</h3>
            <p className="text-[10px] text-gray-400">{stats.totalConversations} conversas no período</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Tempo Médio Resposta</p>
          <p className="text-sm font-bold text-emerald-600">{stats.avgResponseTimeGlobal.toFixed(1)} min</p>
        </div>
      </div>

      {/* Message Direction */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-emerald-50 rounded-xl p-3 text-center">
          <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-1">Inbound</p>
          <p className="text-xl font-bold text-emerald-900">{stats.inboundCount}</p>
          <p className="text-[10px] text-emerald-600">{inboundPct.toFixed(1)}% das msgs</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider mb-1">Outbound</p>
          <p className="text-xl font-bold text-blue-900">{stats.outboundCount}</p>
          <p className="text-[10px] text-blue-600">{outboundPct.toFixed(1)}% das msgs</p>
        </div>
      </div>

      {/* Comparativo por Usuário */}
      <div>
        <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Comparativo por Usuário</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="py-2 text-[10px] font-bold text-gray-400 uppercase">Usuário</th>
                <th className="py-2 text-[10px] font-bold text-gray-400 uppercase text-center">In</th>
                <th className="py-2 text-[10px] font-bold text-gray-400 uppercase text-center">Out</th>
                <th className="py-2 text-[10px] font-bold text-gray-400 uppercase text-center text-emerald-600">Ganho</th>
                <th className="py-2 text-[10px] font-bold text-gray-400 uppercase text-center text-rose-600">Perdido</th>
                <th className="py-2 text-[10px] font-bold text-gray-400 uppercase text-right">T.M.R</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.userStats.map(u => (
                <tr key={u.userId} className="group hover:bg-gray-50/50 transition-colors">
                  <td className="py-2.5">
                    <p className="text-[11px] font-semibold text-gray-700 truncate max-w-[100px]">{u.userName}</p>
                  </td>
                  <td className="py-2.5 text-center text-[11px] text-gray-600">{u.inbound}</td>
                  <td className="py-2.5 text-center text-[11px] text-gray-600">{u.outbound}</td>
                  <td className="py-2.5 text-center text-[11px] font-bold text-emerald-600">{u.won}</td>
                  <td className="py-2.5 text-center text-[11px] font-bold text-rose-600">{u.lost}</td>
                  <td className="py-2.5 text-right text-[11px] font-medium text-gray-500">{u.avgResponseTime > 0 ? `${u.avgResponseTime.toFixed(0)}m` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Distribution */}
      <div>
        <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Status das Conversas</h4>
        <div className="grid grid-cols-3 gap-4">
          {[
            { key: 'open', label: 'Abertas', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { key: 'pending', label: 'Pendentes', color: 'text-amber-600', bg: 'bg-amber-50' },
            { key: 'closed', label: 'Encerradas', color: 'text-gray-600', bg: 'bg-gray-50' },
          ].map(s => (
            <div key={s.key} className={`${s.bg} rounded-xl p-2 text-center`}>
              <p className="text-[9px] font-bold uppercase tracking-tight mb-0.5" style={{ color: 'inherit' }}>{s.label}</p>
              <p className={`text-sm font-bold ${s.color}`}>{stats.byStatus[s.key] || 0}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
