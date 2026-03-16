import { Client } from '../../../lib/supabase';

interface DistributionChartsProps {
  /** List of clients to be visualized. Defaults to an empty array to avoid runtime errors. */
  clients?: Client[];
}

/**
 * DistributionCharts component
 *
 * Renders two bar‑style charts:
 * 1. Distribution by Platform
 * 2. Distribution by Category
 *
 * The component is defensive: it works even when `clients` is undefined or an empty array.
 */
export default function DistributionCharts({
  clients = [], // default to empty array for robustness
}: DistributionChartsProps) {
  // ---------- Distribuição por Plataforma ----------
  // Initialise the map that will hold the count per platform.
  const platformCounts: Record<string, number> = {};

  // Populate platformCounts safely.
  clients.forEach((c) => {
    const platform = c.platform?.trim() || 'Outro';
    platformCounts[platform] = (platformCounts[platform] ?? 0) + 1;
  });

  // Convert to sortable array and order by count descending.
  const platforms = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]);

  // Guard against an empty list – Math.max([]) returns -Infinity, so we ensure a minimum of 1.
  const maxPlatform = Math.max(...platforms.map((p) => p[1]), 1);

  // Colour mapping for known platforms; fallback to a generic gray.
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

  const categoryColors = [
    'bg-[#004aad]',
    'bg-orange-400',
    'bg-amber-400',
    'bg-emerald-500',
    'bg-rose-400',
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Distribuição por Plataforma */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Distribuição por Plataforma
        </h3>
        <div className="space-y-3">
          {platforms.map(([platform, count]) => (
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
                <span className="text-xs font-semibold text-gray-500">
                  {count} creators
                </span>
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
          ))}
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
            const catColorBg: Record<string,string> = {
              'bg-[#004aad]': 'text-[#004aad] bg-[#004aad]/10',
              'bg-orange-400': 'text-orange-700 bg-orange-50',
              'bg-amber-400': 'text-amber-700 bg-amber-50',
              'bg-emerald-500': 'text-emerald-700 bg-emerald-50',
              'bg-rose-400': 'text-rose-700 bg-rose-50',
            };
            const badgeClass = catColorBg[catColorBar] || 'text-gray-600 bg-gray-100';
            const maxCat = Math.max(...categories.map(c => c[1]), 1);
            return (
              <div key={category}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <i className="ri-medal-line text-sm text-gray-500"></i>
                    <span className="text-sm font-medium text-gray-700">{category}</span>
                  </div>
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${badgeClass}`}>
                    {count} creators
                  </span>
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
    </div>
  );
}
