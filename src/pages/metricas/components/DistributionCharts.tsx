import { Client } from '../../../lib/supabase';

interface DistributionChartsProps {
  /** List of clients to be visualized. Defaults to an empty array to avoid runtime errors. */
  clients?: Client[];
}

/**
 * DistributionCharts component
 *
 * Renders three bar‑style charts:
 * 1. Distribution by Platform
 * 2. Distribution by Category
 * 3. Distribution by Capture Source
 *
 * The component is defensive: it works even when `clients` is undefined or an empty array.
 */
export default function DistributionCharts({
  clients = [], // default to empty array for robustness
}: DistributionChartsProps) {
  const totalClients = clients.length || 1;

  // ---------- Distribuição por Plataforma ----------
  const platformCounts: Record<string, number> = {};
  clients.forEach((c) => {
    const platform = c.platform?.trim() || 'Outro';
    platformCounts[platform] = (platformCounts[platform] ?? 0) + 1;
  });

  const platforms = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]);
  const maxPlatform = Math.max(...platforms.map((p) => p[1]), 1);

  const platformColors: Record<string, string> = {
    TikTok: 'bg-[#004aad]',
    Instagram: 'bg-rose-500',
    YouTube: 'bg-red-500',
    Kwai: 'bg-orange-500',
    Outro: 'bg-gray-400',
  };

  // ---------- Distribuição por Categoria ----------
  const categoryCounts: Record<string, number> = {};
  clients.forEach((c) => {
    const cat = c.category?.trim() || 'Creator';
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
  });

  const categories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(...categories.map(c => c[1]), 1);

  const categoryColors = [
    'bg-[#004aad]',
    'bg-orange-400',
    'bg-amber-400',
    'bg-emerald-500',
    'bg-rose-400',
  ];

  // ---------- Distribuição por Fonte de Captura ----------
  const sourceCounts: Record<string, number> = {};
  clients.forEach((c) => {
    const source = (c as any).capture_source?.trim() || 'Direto';
    sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
  });

  const sources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);
  const maxSource = Math.max(...sources.map(s => s[1]), 1);

  const sourceColors = [
    'bg-violet-500',
    'bg-indigo-500',
    'bg-blue-500',
    'bg-cyan-500',
    'bg-teal-500',
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Distribuição por Plataforma */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Distribuição por Plataforma
        </h3>
        <div className="space-y-3">
          {platforms.map(([platform, count]) => {
            const pct = (count / totalClients) * 100;
            return (
              <div key={platform}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <i
                      className={`ri-${
                        platform.toLowerCase() === 'tiktok'
                          ? 'tiktok'
                          : platform.toLowerCase() === 'instagram'
                          ? 'instagram'
                          : platform.toLowerCase() === 'youtube'
                          ? 'youtube'
                          : 'global'
                      }-line text-sm text-gray-600`}
                    ></i>
                    <span className="text-sm font-medium text-gray-700">
                      {platform}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-gray-900 block">
                      {count}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      platformColors[platform] || 'bg-gray-400'
                    }`}
                    style={{ width: `${(count / maxPlatform) * 100}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
          {platforms.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              Sem dados
            </p>
          )}
        </div>
      </div>

      {/* Distribuição por Categoria */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Distribuição por Categoria
        </h3>
        <div className="space-y-3">
          {categories.map(([category, count], idx) => {
            const catColorBar = categoryColors[idx % categoryColors.length];
            const pct = (count / totalClients) * 100;
            return (
              <div key={category}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <i className="ri-medal-line text-sm text-gray-500"></i>
                    <span className="text-sm font-medium text-gray-700 truncate max-w-[120px]">{category}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-gray-900 block">
                      {count}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${catColorBar}`}
                    style={{ width: `${(count / maxCat) * 100}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
          {categories.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              Sem dados
            </p>
          )}
        </div>
      </div>

      {/* Distribuição por Fonte de Captura */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Distribuição por Fonte
        </h3>
        <div className="space-y-3">
          {sources.map(([source, count], idx) => {
            const sourceColorBar = sourceColors[idx % sourceColors.length];
            const pct = (count / totalClients) * 100;
            return (
              <div key={source}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <i className="ri-share-line text-sm text-gray-500"></i>
                    <span className="text-sm font-medium text-gray-700 truncate max-w-[120px]">{source}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-gray-900 block">
                      {count}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${sourceColorBar}`}
                    style={{ width: `${(count / maxSource) * 100}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
          {sources.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              Sem dados
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
