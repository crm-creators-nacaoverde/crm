import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface WhatsAppStats {
  totalConversations: number;
  totalMessages: number;
  inboundCount: number;
  outboundCount: number;
  newConversations: number;
  oldConversations: number;
  byStatus: Record<string, number>;
}

export default function WhatsAppWidget() {
  const [stats, setStats] = useState<WhatsAppStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWhatsApp = async () => {
      setLoading(true);
      
      // Get conversations
      const { data: conversations } = await supabase
        .from('wa_conversations')
        .select('id, status, created_at');

      // Get messages
      const { data: messages } = await supabase
        .from('wa_messages')
        .select('direction, conversation_id, created_at');

      if (conversations && messages) {
        const inboundCount = messages.filter(m => m.direction === 'inbound').length;
        const outboundCount = messages.filter(m => m.direction === 'outbound').length;
        
        const byStatus: Record<string, number> = {};
        conversations.forEach(c => {
          byStatus[c.status] = (byStatus[c.status] || 0) + 1;
        });

        // New vs Old (created in last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const newConversations = conversations.filter(c => new Date(c.created_at) >= sevenDaysAgo).length;
        const oldConversations = conversations.length - newConversations;

        setStats({
          totalConversations: conversations.length,
          totalMessages: messages.length,
          inboundCount,
          outboundCount,
          newConversations,
          oldConversations,
          byStatus
        });
      }
      setLoading(false);
    };

    fetchWhatsApp();
  }, []);

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 h-full flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#5de0e6] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!stats) return null;

  const inboundPct = stats.totalMessages > 0 ? (stats.inboundCount / stats.totalMessages) * 100 : 0;
  const outboundPct = stats.totalMessages > 0 ? (stats.outboundCount / stats.totalMessages) * 100 : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 h-full">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
          <i className="ri-whatsapp-line text-base text-emerald-600"></i>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">WhatsApp</h3>
          <p className="text-[10px] text-gray-400">{stats.totalConversations} conversas totais</p>
        </div>
      </div>

      <div className="space-y-6">
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

        {/* New vs Old */}
        <div>
          <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Novas vs Antigas (7 dias)</h4>
          <div className="flex items-center gap-2 h-2 rounded-full overflow-hidden bg-gray-100">
            <div className="h-full bg-emerald-500" style={{ width: `${(stats.newConversations / stats.totalConversations) * 100}%` }}></div>
            <div className="h-full bg-gray-300" style={{ width: `${(stats.oldConversations / stats.totalConversations) * 100}%` }}></div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span className="text-[10px] text-gray-500">Novas: {stats.newConversations}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
              <span className="text-[10px] text-gray-500">Antigas: {stats.oldConversations}</span>
            </div>
          </div>
        </div>

        {/* Status Distribution */}
        <div>
          <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Status das Conversas</h4>
          <div className="space-y-2">
            {[
              { key: 'open', label: 'Abertas', color: 'bg-emerald-500' },
              { key: 'pending', label: 'Pendentes', color: 'bg-amber-500' },
              { key: 'closed', label: 'Encerradas', color: 'bg-gray-400' },
            ].map(s => {
              const count = stats.byStatus[s.key] || 0;
              const pct = stats.totalConversations > 0 ? (count / stats.totalConversations) * 100 : 0;
              return (
                <div key={s.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-gray-600">{s.label}</span>
                    <span className="text-[11px] font-bold text-gray-900">{count}</span>
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${s.color} rounded-full`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
