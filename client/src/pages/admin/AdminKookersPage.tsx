import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Search, Star, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface KookerUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
}

interface AdminKooker {
  id: number;
  city: string | null;
  type: string | string[] | null;
  rating: number;
  reviewCount: number;
  featured: boolean;
  verified: boolean;
  active: boolean;
  createdAt: string;
  user: KookerUser;
  _count: { services: number; bookingsReceived: number };
}

interface KookersResponse {
  kookers: AdminKooker[];
  total: number;
  page: number;
  limit: number;
}

interface AdminReview {
  id: number;
  rating: number;
  comment: string | null;
  status: string;
  createdAt: string;
  user: { id: number; firstName: string; lastName: string; avatar: string | null };
}

export default function AdminKookersPage() {
  const [data, setData] = useState<KookersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [reviewTarget, setReviewTarget] = useState<{ id: number; name: string } | null>(null);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  useEffect(() => { document.title = 'Admin — Kookers | Weekook'; }, []);

  const fetchKookers = async (s = search, p = page) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: '20' });
    if (s) params.set('search', s);
    const res = await api.get<KookersResponse>(`/admin/kookers?${params}`);
    if (res.success && res.data) setData(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchKookers(search, page); }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchKookers(search, 1);
  };

  const openReviews = async (kookerId: number, kookerName: string) => {
    setReviewTarget({ id: kookerId, name: kookerName });
    setReviewsLoading(true);
    setReviews([]);
    const res = await api.get<AdminReview[]>(`/admin/reviews/kooker/${kookerId}`);
    if (res.success && res.data) setReviews(res.data);
    setReviewsLoading(false);
  };

  const handleApproveReview = async (reviewId: number) => {
    const res = await api.put(`/admin/reviews/${reviewId}/status`, { status: 'approved' });
    if (res.success) {
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, status: 'approved' } : r));
      toast.success('Avis approuvé et publié');
      fetchKookers(search, page);
    }
  };

  const handleDeleteReview = async (reviewId: number) => {
    await api.delete(`/admin/reviews/${reviewId}`);
    setReviews(prev => prev.filter(r => r.id !== reviewId));
    toast.success('Avis supprimé');
    fetchKookers(search, page);
  };

  const toggle = async (id: number, field: 'featured' | 'verified' | 'active', current: boolean) => {
    const res = await api.put(`/admin/kookers/${id}`, { [field]: !current });
    if (res.success) fetchKookers(search, page);
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <>
    <div>
      <h1 className="text-2xl font-bold text-[#111125] mb-6">Kookers</h1>

      <div className="bg-white rounded-[20px] p-4 mb-4 flex gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nom, email, ville..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-[12px] text-sm focus:outline-none focus:border-[#c1a0fd]"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-[#c1a0fd] text-white rounded-[12px] text-sm font-medium hover:bg-[#b090ed]">
            Chercher
          </button>
        </form>
      </div>

      <div className="bg-white rounded-[20px] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Chargement...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">ID</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Kooker</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Ville</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Note</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Services</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Réservations</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">⭐ Coup de cœur</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">✓ Vérifié</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Actif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.kookers.map(k => (
                  <tr key={k.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-400">#{String(k.id).padStart(5, '0')}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#111125]">{k.user.firstName} {k.user.lastName}</div>
                      <div className="text-xs text-gray-400">{k.user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{k.city ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(() => {
                          const types = Array.isArray(k.type) ? k.type : (() => { try { return JSON.parse(k.type as string || '[]'); } catch { return []; } })();
                          return (types as string[]).map((t: string) => (
                            <span key={t} className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold text-white ${t === 'COURS' ? 'bg-[#c1a0fd]' : 'bg-[#7c5cbf]'}`}>{t}</span>
                          ));
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openReviews(k.id, `${k.user.firstName} ${k.user.lastName}`)}
                        className="flex items-center gap-1 text-yellow-500 hover:text-yellow-600 font-medium text-sm transition-colors"
                        title="Voir les avis"
                      >
                        <Star size={13} className="fill-yellow-400 text-yellow-400" />
                        {k.rating.toFixed(1)}
                        <span className="text-gray-400 font-normal">({k.reviewCount})</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{k._count.services}</td>
                    <td className="px-4 py-3 text-gray-600">{k._count.bookingsReceived}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggle(k.id, 'featured', k.featured)} title="Toggle coup de cœur">
                        <Star size={18} className={k.featured ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggle(k.id, 'verified', k.verified)} title="Toggle vérifié">
                        <CheckCircle size={18} className={k.verified ? 'text-green-500' : 'text-gray-300'} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggle(k.id, 'active', k.active)} title="Toggle actif">
                        {k.active
                          ? <CheckCircle size={18} className="text-[#c1a0fd]" />
                          : <XCircle size={18} className="text-red-400" />
                        }
                      </button>
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
      {/* ── Reviews Modal ── */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-[20px] w-full max-w-[520px] shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-[16px] font-bold text-[#111125]">Avis — {reviewTarget.name}</h2>
                <p className="text-[12px] text-gray-400 mt-0.5">{reviews.length} avis</p>
              </div>
              <button onClick={() => setReviewTarget(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <XCircle size={20} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {reviewsLoading ? (
                <p className="text-center text-sm text-gray-400 py-8">Chargement...</p>
              ) : reviews.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">Aucun avis pour ce kooker.</p>
              ) : (
                reviews.map(r => (
                  <div key={r.id} className={`rounded-[12px] p-4 border ${r.status === 'pending' ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-transparent'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[13px] font-semibold text-[#111125]">
                            {r.user.firstName} {r.user.lastName}
                          </span>
                          <span className="text-yellow-400 text-[13px]">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                          {r.status === 'pending' && (
                            <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300">
                              En attente
                            </span>
                          )}
                        </div>
                        {r.comment && <p className="text-[13px] text-gray-600 leading-relaxed">{r.comment}</p>}
                        <p className="text-[11px] text-gray-400 mt-1">{new Date(r.createdAt).toLocaleDateString('fr-FR')}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                        {r.status === 'pending' && (
                          <button
                            onClick={() => handleApproveReview(r.id)}
                            className="text-green-500 hover:text-green-700 transition-colors"
                            title="Approuver cet avis"
                          >
                            <CheckCircle size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteReview(r.id)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                          title={r.status === 'pending' ? 'Rejeter et supprimer' : 'Supprimer cet avis'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
