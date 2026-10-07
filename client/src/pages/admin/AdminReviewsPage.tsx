import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Star, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface AdminReview {
  id: number;
  type: 'user_to_kooker' | 'kooker_to_user';
  rating: number;
  comment: string | null;
  status: string;
  bookingId: number | null;
  createdAt: string;
  user: { id: number; firstName: string; lastName: string; avatar: string | null };
  kookerProfile: {
    id: number;
    user: { id: number; firstName: string; lastName: string };
  } | null;
  targetUser: { id: number; firstName: string; lastName: string; avatar: string | null } | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  approved: 'Approuvé',
  rejected: 'Rejeté',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
};

type StatusFilter = 'pending' | 'approved' | 'rejected';
type TypeFilter = 'all' | 'user_to_kooker' | 'kooker_to_user';

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: 'Tous',
  user_to_kooker: 'Client → Kooker',
  kooker_to_user: 'Kooker → Client',
};

const TYPE_BADGE: Record<string, string> = {
  user_to_kooker: 'bg-purple-50 text-purple-600',
  kooker_to_user: 'bg-orange-50 text-orange-600',
};

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={13} className={s <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
      ))}
      <span className="text-xs text-gray-400 ml-1">{rating}/5</span>
    </div>
  );
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [total, setTotal] = useState(0);

  useEffect(() => { document.title = 'Admin — Avis | Weekook'; }, []);

  const fetchReviews = async (status: StatusFilter, type: TypeFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status, limit: '50' });
      if (type !== 'all') params.set('type', type);
      const res = await api.get<{ reviews: AdminReview[]; pagination: { total: number } }>(
        `/admin/reviews?${params.toString()}`
      );
      if (res.success && res.data) {
        setReviews(res.data.reviews);
        setTotal(res.data.pagination.total);
      }
    } catch {
      toast.error('Erreur lors du chargement des avis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReviews(statusFilter, typeFilter); }, [statusFilter, typeFilter]);

  const updateStatus = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await api.put(`/admin/reviews/${id}/status`, { status });
      toast.success(status === 'approved' ? 'Avis approuvé' : 'Avis rejeté');
      fetchReviews(statusFilter, typeFilter);
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const deleteReview = async (id: number) => {
    if (!confirm('Supprimer définitivement cet avis ?')) return;
    try {
      await api.delete(`/admin/reviews/${id}`);
      toast.success('Avis supprimé');
      fetchReviews(statusFilter, typeFilter);
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const getDirection = (r: AdminReview) => {
    if (r.type === 'user_to_kooker') {
      return {
        from: `${r.user.firstName} ${r.user.lastName}`,
        to: r.kookerProfile
          ? `${r.kookerProfile.user.firstName} ${r.kookerProfile.user.lastName}`
          : '—',
      };
    }
    // kooker_to_user: user field = kooker, targetUser = client
    return {
      from: r.kookerProfile
        ? `${r.kookerProfile.user.firstName} ${r.kookerProfile.user.lastName}`
        : `${r.user.firstName} ${r.user.lastName}`,
      to: r.targetUser
        ? `${r.targetUser.firstName} ${r.targetUser.lastName}`
        : '—',
    };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111125]">Modération des avis</h1>
          <p className="text-sm text-gray-500 mt-1">{total} avis pour ce filtre</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-2">
          {(['pending', 'approved', 'rejected'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-[10px] text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-[#c1a0fd] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-[#c1a0fd]/10 hover:text-[#c1a0fd]'
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="w-px bg-gray-200 self-stretch" />
        <div className="flex gap-2">
          {(['all', 'user_to_kooker', 'kooker_to_user'] as TypeFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-[10px] text-xs font-medium transition-colors ${
                typeFilter === t
                  ? 'bg-[#111125] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Chargement...</div>
      ) : reviews.length === 0 ? (
        <div className="bg-white rounded-[20px] p-8 text-center text-gray-400 text-sm">
          Aucun avis {STATUS_LABELS[statusFilter].toLowerCase()}
          {typeFilter !== 'all' ? ` · ${TYPE_LABELS[typeFilter]}` : ''}
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => {
            const dir = getDirection(r);
            return (
              <div
                key={r.id}
                className="bg-white rounded-[20px] p-5 flex flex-col sm:flex-row gap-4 border border-[#f0f0f0]"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-medium text-[#111125] text-sm">{dir.from}</span>
                    <span className="text-gray-400 text-xs">→</span>
                    <span className="text-[#6b7280] text-sm">{dir.to}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${TYPE_BADGE[r.type]}`}>
                      {TYPE_LABELS[r.type as TypeFilter]}
                    </span>
                    <span className={`ml-auto px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </div>

                  <StarRow rating={r.rating} />

                  {r.comment && (
                    <p className="text-sm text-gray-600 leading-relaxed mt-2">{r.comment}</p>
                  )}

                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(r.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                    {r.bookingId && (
                      <span className="ml-2 text-gray-300">
                        · Résa #{String(r.bookingId).padStart(5, '0')}
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex sm:flex-col gap-2 shrink-0">
                  {r.status === 'pending' && (
                    <>
                      <button
                        onClick={() => updateStatus(r.id, 'approved')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-green-50 text-green-600 hover:bg-green-100 text-xs font-medium transition-colors"
                      >
                        <Check size={14} /> Approuver
                      </button>
                      <button
                        onClick={() => updateStatus(r.id, 'rejected')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-red-50 text-red-500 hover:bg-red-100 text-xs font-medium transition-colors"
                      >
                        <X size={14} /> Rejeter
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => deleteReview(r.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors self-start"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
