import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ChefHat, Menu, X, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';

const navLinks = [
  { label: 'Accueil', path: '/' },
  { label: 'Tarification', path: '/tarification' },
  { label: 'FAQ', path: '/faq' },
  { label: 'A propos', path: '/a-propos' },
];

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { unreadCount } = useNotification();

  // Auto-close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const isActive = (path: string) => location.pathname === path;
  const isUserDashboard = location.pathname === '/tableau-de-bord';

  return (
    <header className="sticky top-0 z-50 bg-[#f2f4fc] shadow-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
      <nav className="h-[80px] px-6 lg:px-[96px] flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <div className="bg-[#c1a0fd] w-[36px] h-[36px] rounded-full flex items-center justify-center">
            <ChefHat className="size-5 text-white" />
          </div>
          <span className="font-bold text-[28px] text-[#303044] tracking-[-0.56px]">
            WEEKOOK
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-[32px]">
          {/* Nav Links */}
          <div className="flex items-center gap-[24px]">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`font-medium text-[16px] tracking-[-0.32px] transition-opacity hover:opacity-80 ${
                  isActive(link.path)
                    ? 'text-[#c1a0fd]'
                    : 'text-[#303044]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth / Profile Actions */}
          <div className="flex items-center gap-[16px]">
            {user ? (
              <>
                {/* Admin link */}
                {user.isAdmin && (
                  <Link
                    to="/admin"
                    className={`flex items-center gap-1.5 font-medium text-[14px] transition-opacity hover:opacity-80 ${
                      location.pathname.startsWith('/admin') ? 'text-[#c1a0fd]' : 'text-[#303044]'
                    }`}
                  >
                    <Settings size={15} />
                    Admin
                  </Link>
                )}

                {/* Profile icon */}
                <button
                  onClick={() => navigate(user.kookerProfileId ? '/kooker-dashboard' : '/tableau-de-bord')}
                  className={`w-[48px] h-[48px] rounded-full flex items-center justify-center cursor-pointer transition-colors overflow-hidden ${
                    isUserDashboard
                      ? 'ring-2 ring-[#c1a0fd] ring-offset-2'
                      : 'bg-[#e8deff] hover:bg-[#c1a0fd]'
                  }`}
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar.startsWith('http') || user.avatar.startsWith('/') ? user.avatar : `/uploads/${user.avatar}`}
                      alt="Mon profil"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="#111125" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="#111125" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>

                {/* Messagerie button with envelope icon */}
                <button
                  onClick={() => navigate('/messagerie')}
                  className={`relative h-[48px] px-[16px] rounded-[12px] flex items-center gap-[8px] cursor-pointer transition-colors ${
                    location.pathname === '/messagerie'
                      ? 'bg-[#c1a0fd] border-b-2 border-[#111125]'
                      : 'bg-[#c1a0fd] hover:bg-[#b090ed]'
                  }`}
                  aria-label="Messagerie"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111125" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                  <span className="font-medium text-[14px] text-[#111125] tracking-[-0.32px]">messagerie</span>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Become Kooker button (non-kookers only) */}
                {!user.kookerProfileId && (
                  <button
                    onClick={() => navigate('/devenir-kooker')}
                    className="h-[48px] px-[20px] rounded-[8px] bg-[#c1a0fd] text-[#111125] font-medium text-[14px] tracking-[-0.32px] transition-colors hover:bg-[#b090ed] cursor-pointer"
                  >
                    Devenir Kooker
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={() => navigate('/connexion')}
                className="bg-[#c1a0fd] h-[48px] px-[24px] rounded-[8px] font-medium text-[16px] text-[#111125] tracking-[-0.32px] transition-colors hover:bg-[#b090ed] cursor-pointer flex items-center gap-[8px]"
              >
                Se connecter / S'inscrire
              </button>
            )}
          </div>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden w-[48px] h-[48px] rounded-full bg-[#c1a0fd] flex items-center justify-center transition-colors hover:bg-[#b090ed] cursor-pointer"
          aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          {mobileMenuOpen ? (
            <X className="size-6 text-white" />
          ) : (
            <Menu className="size-6 text-white" />
          )}
        </button>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed top-[80px] left-0 right-0 bottom-0 z-40 bg-[#f2f4fc] overflow-y-auto shadow-lg border-t border-[#e0e0e6]">
          <div className="flex flex-col p-6 gap-4">
            {/* Navigation Links */}
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`p-4 rounded-lg font-medium text-[18px] transition-colors ${
                  isActive(link.path)
                    ? 'text-[#c1a0fd] bg-white'
                    : 'text-[#303044] hover:bg-white'
                }`}
              >
                {link.label}
              </Link>
            ))}

            {/* Separator */}
            <div className="border-t border-[#e0e0e6] my-2" />

            {/* Auth Actions */}
            {user ? (
              <>
                {user.isAdmin && (
                  <Link
                    to="/admin"
                    className={`p-4 rounded-lg font-medium text-[18px] transition-colors flex items-center gap-2 ${
                      location.pathname.startsWith('/admin') ? 'bg-[#c1a0fd] text-[#111125]' : 'bg-white hover:bg-[#f3ecff] text-[#303044]'
                    }`}
                  >
                    <Settings size={18} />
                    Administration
                  </Link>
                )}

                <button
                  onClick={() => navigate(user.kookerProfileId ? '/kooker-dashboard' : '/tableau-de-bord')}
                  className={`p-4 rounded-lg font-medium text-[18px] transition-colors text-left cursor-pointer ${
                    isUserDashboard ? 'bg-[#c1a0fd] text-[#111125]' : 'bg-white hover:bg-[#f3ecff] text-[#303044]'
                  }`}
                >
                  Mon Profil
                </button>

                <button
                  onClick={() => navigate('/messagerie')}
                  className={`p-4 rounded-lg font-medium text-[18px] transition-colors text-left cursor-pointer flex items-center justify-between ${
                    location.pathname === '/messagerie' ? 'bg-[#c1a0fd] text-[#111125]' : 'bg-white hover:bg-[#f3ecff] text-[#303044]'
                  }`}
                >
                  <span>Messagerie</span>
                  {unreadCount > 0 && (
                    <span className="min-w-[22px] h-[22px] bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {!user.kookerProfileId && (
                  <button
                    onClick={() => navigate('/devenir-kooker')}
                    className="bg-[#c1a0fd] p-4 rounded-lg font-medium text-[18px] text-[#111125] transition-colors hover:bg-[#b090ed] cursor-pointer"
                  >
                    Devenir Kooker
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={() => navigate('/connexion')}
                className="bg-[#c1a0fd] p-4 rounded-lg font-medium text-[18px] text-[#111125] transition-colors hover:bg-[#b090ed] text-center cursor-pointer"
              >
                Se connecter / S'inscrire
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
