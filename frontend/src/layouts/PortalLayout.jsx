import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { LayoutDashboard, Package, Heart, MapPin, UserCircle, FileText } from 'lucide-react';
import { useAuth, customerAuthHeaders } from '../context/AuthContext';
import { API } from '../lib/api';
import { toast } from '../components/ui/sonner';

const NAV_ITEMS = [
  { to: '/portal/dashboard', label: 'Dashboard', icon: LayoutDashboard, enabled: true },
  { to: '/portal/orders', label: 'My Orders', icon: Package, enabled: true },
  { to: '/portal/quotes', label: 'My Quotes', icon: FileText, enabled: true },
  { to: '/portal/wishlist', label: 'Wishlist', icon: Heart, enabled: true },
  { to: '/portal/addresses', label: 'Addresses', icon: MapPin, enabled: true },
  { to: '/portal/profile', label: 'Profile', icon: UserCircle, enabled: true },
];

export default function PortalLayout() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated || (user && user.role !== 'customer')) {
      navigate('/login');
    }
  }, [isAuthenticated, user, navigate]);

  // Re-validated once per navigation, not on a timer — visiting a different
  // Portal page is already a natural action, so this rides along with it
  // instead of polling. The backend (deps.py get_session) rejects every
  // request from a deactivated/suspended account regardless; this just
  // makes sure that shows up as a clean logout + redirect rather than each
  // page silently failing to load while the user still looks "logged in."
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch(`${API}/customers/me`, { headers: customerAuthHeaders() }).then((r) => {
      if (r.status === 401) {
        logout();
        toast.error('Your account is no longer active. Please contact support if this is unexpected.');
        navigate('/login');
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  if (!isAuthenticated || (user && user.role !== 'customer')) return null;

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8">
      <p className="text-xs uppercase tracking-[0.2em] text-[#5E6A7D]">Antigravity Portal</p>
      <h1 className="font-display mt-1 text-3xl text-[#121826]">Welcome back, {user?.name?.split(' ')[0]}</h1>

      <div className="mt-8 flex flex-col gap-8 sm:flex-row">
        <nav className="sticky top-20 flex shrink-0 flex-row gap-1 self-start overflow-x-auto sm:w-52 sm:flex-col sm:overflow-visible">
          {NAV_ITEMS.map(({ to, label, icon: Icon, enabled }) =>
            enabled ? (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive ? 'bg-[#0B132B] text-white' : 'text-[#5E6A7D] hover:bg-black/5'
                  }`
                }
              >
                <Icon size={16} /> {label}
              </NavLink>
            ) : (
              <span
                key={to}
                title="Coming soon"
                className="flex cursor-not-allowed items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm text-[#B7BFC9]"
              >
                <Icon size={16} /> {label}
              </span>
            )
          )}
        </nav>

        <div className="min-w-0 flex-1">
          <Outlet key={user?.id} />
        </div>
      </div>
    </div>
  );
}
