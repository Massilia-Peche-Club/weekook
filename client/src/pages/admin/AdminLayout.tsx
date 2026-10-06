import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  ChefHat,
  CalendarDays,
  UtensilsCrossed,
  MessageSquareQuote,
  Star,
  HelpCircle,
  Settings,
  LogOut,
  ArrowLeft,
} from 'lucide-react';

const navItems = [
  { to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/admin/utilisateurs', label: 'Utilisateurs', icon: Users },
  { to: '/admin/kookers', label: 'Kookers', icon: ChefHat },
  { to: '/admin/reservations', label: 'Réservations', icon: CalendarDays },
  { to: '/admin/services', label: 'Services', icon: UtensilsCrossed },
  { to: '/admin/temoignages', label: 'Témoignages', icon: MessageSquareQuote },
  { to: '/admin/avis', label: 'Avis', icon: Star },
  { to: '/admin/faq', label: 'FAQ', icon: HelpCircle },
  { to: '/admin/configuration', label: 'Configuration', icon: Settings },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/connexion');
  };

  return (
    <div className="flex min-h-screen bg-[#f2f4fc]">
      {/* Sidebar */}
      <aside className="w-[240px] shrink-0 bg-white border-r border-gray-100 flex flex-col">
        {/* Logo */}
        <div className="h-[64px] flex items-center px-6 border-b border-gray-100">
          <span className="text-[#c1a0fd] font-bold text-lg">Weekook</span>
          <span className="ml-2 text-xs bg-[#c1a0fd]/10 text-[#c1a0fd] px-2 py-0.5 rounded-full font-medium">Admin</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#c1a0fd]/10 text-[#c1a0fd]'
                    : 'text-[#111125] hover:bg-gray-50'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User + Actions */}
        <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-2">
          <div className="text-xs text-gray-500 mb-1 truncate">{user?.email}</div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 transition-colors w-full"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {/* Topbar */}
        <div className="h-[64px] bg-white border-b border-gray-100 flex items-center justify-end px-8">
          <Link
            to="/tableau-de-bord"
            className="flex items-center gap-2 px-4 py-2 bg-[#c1a0fd]/10 text-[#c1a0fd] hover:bg-[#c1a0fd] hover:text-white rounded-[12px] text-sm font-medium transition-colors"
          >
            <ArrowLeft size={15} />
            Retour à l'appli
          </Link>
        </div>
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
