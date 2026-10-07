import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { ChefHat } from 'lucide-react';

type Status = 'loading' | 'success' | 'error';

interface UserData {
  id: number;
  email: string;
  firstName: string;
}

export default function ConfirmEmailChangePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Confirmation changement email | Weekook';
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setError('Token manquant ou invalide.');
      return;
    }

    api.get<UserData>(`/users/confirm-email-change?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.success && res.data) {
          setUserData(res.data);
          await refreshUser();
          setStatus('success');
        } else {
          setStatus('error');
          setError('Ce lien est invalide ou a expiré.');
        }
      })
      .catch((err) => {
        setStatus('error');
        setError(err?.error || 'Ce lien est invalide ou a expiré.');
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#f2f4fc] flex items-center justify-center px-4" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="max-w-[440px] w-full bg-white rounded-[20px] p-8 shadow-sm text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-[#c1a0fd] w-[48px] h-[48px] rounded-full flex items-center justify-center">
            <ChefHat className="size-6 text-white" />
          </div>
        </div>

        {status === 'loading' && (
          <div className="space-y-4">
            <div className="w-8 h-8 border-2 border-[#c1a0fd] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-[#5c5c6f] text-[15px]">Confirmation en cours…</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-[22px] font-semibold text-[#111125]">Email mis à jour !</h1>
            <p className="text-[14px] text-[#5c5c6f]">
              Votre adresse email est maintenant <strong>{userData?.email}</strong>
            </p>
            <button
              onClick={() => navigate('/mon-profil')}
              className="w-full h-[48px] bg-[#c1a0fd] hover:bg-[#b090ed] text-white font-semibold text-[15px] rounded-[12px] transition-colors mt-2"
            >
              Retour à mon profil
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-[22px] font-semibold text-[#111125]">Lien invalide</h1>
            <p className="text-[14px] text-[#5c5c6f]">{error}</p>
            <button
              onClick={() => navigate('/mon-profil')}
              className="w-full h-[48px] bg-[#c1a0fd] hover:bg-[#b090ed] text-white font-semibold text-[15px] rounded-[12px] transition-colors mt-2"
            >
              Retour à mon profil
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
