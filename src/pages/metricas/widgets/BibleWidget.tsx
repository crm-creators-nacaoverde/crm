import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface BibleStats {
  totalLessons: number;
  totalCompleted: number;
  avgProgress: number;
  topLessons: { title: string; count: number }[];
  userProgress: { name: string; completed: number; total: number }[];
}

export default function BibleWidget() {
  const [stats, setStats] = useState<BibleStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBible = async () => {
      setLoading(true);
      
      // Get total lessons
      const { data: lessons } = await supabase
        .from('bible_lessons')
        .select('id, title, module_id')
        .eq('is_published', true);

      // Get all progress
      const { data: progress } = await supabase
        .from('bible_progress')
        .select('user_id, lesson_id, completed, updated_at');

      // Get users (to map names)
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name, email');

      if (lessons && progress && users) {
        const lessonMap: Record<string, string> = {};
        lessons.forEach(l => lessonMap[l.id] = l.title);

        const userMap: Record<string, string> = {};
        users.forEach(u => userMap[u.id] = u.full_name || u.email || 'Usuário');

        const completedCount = progress.filter(p => p.completed).length;
        
        // Top lessons (most completed)
        const lessonCounts: Record<string, number> = {};
        progress.filter(p => p.completed).forEach(p => {
          lessonCounts[p.lesson_id] = (lessonCounts[p.lesson_id] || 0) + 1;
        });

        const topLessons = Object.entries(lessonCounts)
          .map(([id, count]) => ({ title: lessonMap[id] || 'Aula desconhecida', count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // User progress
        const userProgressMap: Record<string, { completed: number; total: number }> = {};
        progress.forEach(p => {
          if (!userProgressMap[p.user_id]) userProgressMap[p.user_id] = { completed: 0, total: lessons.length };
          if (p.completed) userProgressMap[p.user_id].completed++;
        });

        const userProgress = Object.entries(userProgressMap)
          .map(([id, data]) => ({ name: userMap[id], ...data }))
          .sort((a, b) => b.completed - a.completed)
          .slice(0, 5);

        const avgProgress = userProgress.length > 0 
          ? userProgress.reduce((s, u) => s + (u.completed / u.total), 0) / userProgress.length * 100
          : 0;

        setStats({
          totalLessons: lessons.length,
          totalCompleted: completedCount,
          avgProgress,
          topLessons,
          userProgress
        });
      }
      setLoading(false);
    };

    fetchBible();
  }, []);

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 h-full flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#5de0e6] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!stats || stats.totalLessons === 0) return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 h-full flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mb-3">
        <i className="ri-book-open-line text-2xl text-amber-600"></i>
      </div>
      <p className="text-sm font-medium text-gray-600">Bíblia Comercial</p>
      <p className="text-xs text-gray-400 mt-1">Nenhuma aula cadastrada ou publicada ainda.</p>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 h-full">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
          <i className="ri-book-open-line text-base text-amber-600"></i>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Bíblia Comercial</h3>
          <p className="text-[10px] text-gray-400">{stats.totalCompleted} aulas concluídas no total</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Average Progress */}
        <div className="bg-amber-50 rounded-xl p-4 text-center">
          <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1">Progresso Médio por Usuário</p>
          <p className="text-2xl font-bold text-amber-900">{stats.avgProgress.toFixed(1)}%</p>
        </div>

        {/* Top Users */}
        <div>
          <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Top Usuários (Engajamento)</h4>
          <div className="space-y-3">
            {stats.userProgress.map((u, idx) => {
              const pct = (u.completed / u.total) * 100;
              return (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-700 truncate max-w-[150px]">{u.name}</span>
                    <span className="text-[10px] font-bold text-gray-900">{u.completed}/{u.total}</span>
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Lessons */}
        <div>
          <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Aulas mais assistidas</h4>
          <div className="space-y-2.5">
            {stats.topLessons.map((l, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-xs text-gray-600 truncate max-w-[180px]">{l.title}</span>
                <span className="text-xs font-semibold text-gray-900">{l.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
