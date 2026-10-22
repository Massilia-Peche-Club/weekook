import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { hasDuration } from '@/lib/utils';

interface ServiceKooker {
  user: { id: number; firstName: string; lastName: string };
}

interface AdminService {
  id: number;
  title: string;
  type: string[] | string;
  priceInCents: number;
  durationMinutes: number;
  active: boolean;
  createdAt: string;
  kookerProfile: ServiceKooker;
  _count: { bookings: number };
}

interface ServicesResponse {
  services: AdminService[];
  total: number;
  page: number;
  limit: number;
}

export default function AdminServicesPage() {
  const [data, setData] = useState<ServicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => { document.title = 'Admin — Services | Weekook'; }, []);

  const fetchServices = async (p = page) => {
    setLoading(true);
    const res = await api.get<ServicesResponse>(`/admin/services?page=${p}&limit=20`);
    if (res.success && res.data) setData(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchServices(page); }, [page]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#111125] mb-6">Services</h1>

      <div className="bg-white rounded-[20px] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Chargement...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">ID</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Titre</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Kooker</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Prix</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Durée</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Réservations</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.services.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-400">#{String(s.id).padStart(5, '0')}</td>
                    <td className="px-4 py-3 font-medium text-[#111125]">{s.title}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {s.kookerProfile.user.firstName} {s.kookerProfile.user.lastName}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(() => {
                          const types = Array.isArray(s.type) ? s.type : (() => { try { return JSON.parse(s.type as string); } catch { return [s.type]; } })();
                          return (types as string[]).map((t: string) => (
                            <span key={t} className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold text-white ${t === 'COURS' ? 'bg-[#c1a0fd]' : 'bg-[#7c5cbf]'}`}>{t}</span>
                          ));
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-[#111125]">
                      {(s.priceInCents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{hasDuration(s.type, s.durationMinutes) ? `${s.durationMinutes} min` : '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{s._count.bookings}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s.active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > data.limit && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
            <span className="text-gray-500">{data.total} résultats</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 border border-gray-200 rounded-[8px] disabled:opacity-40 hover:border-[#c1a0fd]">←</button>
              <span className="px-3 py-1.5 text-gray-500">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 border border-gray-200 rounded-[8px] disabled:opacity-40 hover:border-[#c1a0fd]">→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
