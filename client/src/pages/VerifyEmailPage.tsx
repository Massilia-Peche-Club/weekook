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
  lastName: string;
  role: string;
  isAdmin?: boolean;
  kookerProfileId?: number | null;
}

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Vérification email | Weekook';
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setError('Token manquant ou invalide.');
      return;
    }

    api.get<UserData>(`/auth/verify-email?token=${encodeURIComponent(token)}`)
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
            <p className="text-[#5c5c6f] text-[15px]">Vérification en cours…</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-[22px] font-semibold text-[#111125]">Email confirmé !</h1>
            <p className="text-[14px] text-[#5c5c6f]">
              Bienvenue {userData?.firstName} ! Votre compte est maintenant actif.
            </p>
            <button
              onClick={() => navigate(userData?.kookerProfileId ? '/kooker-dashboard' : '/tableau-de-bord')}
              className="w-full h-[48px] bg-[#c1a0fd] hover:bg-[#b090ed] text-white font-semibold text-[15px] rounded-[12px] transition-colors mt-2"
            >
              Accéder à mon tableau de bord
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
              onClick={() => navigate('/connexion?tab=register')}
              className="w-full h-[48px] bg-[#c1a0fd] hover:bg-[#b090ed] text-white font-semibold text-[15px] rounded-[12px] transition-colors mt-2"
            >
              Créer un nouveau compte
            </button>
            <button
              onClick={() => navigate('/connexion')}
              className="w-full h-[44px] border border-[#e0e2ef] text-[#5c5c6f] font-medium text-[14px] rounded-[12px] hover:border-[#c1a0fd] hover:text-[#c1a0fd] transition-colors mt-2"
            >
              Se connecter
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
