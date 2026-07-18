import { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { ShoppingBag, User, LogOut, MessageCircleQuestion, LayoutDashboard, Package, Heart, MapPin, UserCircle, ChevronDown } from 'lucide-react';
import { API } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { CartDrawer } from '../components/CartDrawer';
import { ChatWidget } from '../components/ChatWidget';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '../components/ui/dropdown-menu';
import { STOREFRONT } from '../constants/testIds';

const ACCOUNT_LINKS = [
  { to: '/portal/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/portal/orders', label: 'My Orders', icon: Package },
  { to: '/portal/wishlist', label: 'Wishlist', icon: Heart },
  { to: '/portal/addresses', label: 'Addresses', icon: MapPin },
  { to: '/portal/profile', label: 'Profile', icon: UserCircle },
];

export default function StorefrontLayout() {
  const [settings, setSettings] = useState({ storeName: 'Antigravity Wholesale', whatsappNumber: '' });
  const { user, isAuthenticated, logout } = useAuth();
  const { totalItems, setDrawerOpen } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API}/settings/public`).then((r) => r.json()).then(setSettings).catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-[#121826]">
      <header
        data-testid={STOREFRONT.header}
        className="sticky top-0 z-40 border-b border-white/40 bg-white/70 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link data-testid={STOREFRONT.logo} to="/" className="font-display text-xl tracking-tight text-[#0B132B] sm:text-2xl">
            {settings.storeName}
          </Link>
          <nav className="flex items-center gap-5 sm:gap-7">
            <Link data-testid={STOREFRONT.navCatalogLink} to="/catalog" className="text-sm font-medium text-[#121826] transition-colors hover:text-[#FF4500]">
              Catalog
            </Link>
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-sm text-[#5E6A7D] outline-none transition-colors hover:text-[#FF4500]">
                  <span className="hidden sm:inline">{user?.name?.split(' ')[0]}</span>
                  <User size={19} className="sm:hidden" />
                  <ChevronDown size={14} className="hidden sm:inline" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {ACCOUNT_LINKS.map(({ to, label, icon: Icon }) => (
                    <DropdownMenuItem key={to} asChild>
                      <Link to={to} className="flex items-center gap-2 cursor-pointer">
                        <Icon size={15} /> {label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    data-testid={STOREFRONT.logoutButton}
                    onClick={handleLogout}
                    className="flex items-center gap-2 cursor-pointer text-[#EF4444] focus:text-[#EF4444]"
                  >
                    <LogOut size={15} /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link data-testid={STOREFRONT.accountLink} to="/login" className="text-[#121826] transition-colors hover:text-[#FF4500]">
                <User size={19} />
              </Link>
            )}
            <button
              data-testid={STOREFRONT.cartButton}
              onClick={() => setDrawerOpen(true)}
              className="relative text-[#121826] transition-colors hover:text-[#FF4500]"
            >
              <ShoppingBag size={19} />
              {totalItems > 0 && (
                <span data-testid={STOREFRONT.cartBadge} className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF4500] text-[9px] font-bold text-white">
                  {totalItems}
                </span>
              )}
            </button>
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer data-testid={STOREFRONT.footer} className="border-t border-black/5 bg-[#0B101A] px-5 py-14 text-[#F9F8F6] sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-10 sm:flex-row">
          <div>
            <p className="font-display text-2xl">{settings.storeName}</p>
            <p className="mt-2 max-w-xs text-sm text-white/50">Wholesale ordering for boutiques and resellers — quotes, bulk pricing, and fast fulfillment in one place.</p>
          </div>
          <div className="text-sm text-white/70">
            <p>{settings.sellerPhone}</p>
            <p>{settings.sellerEmail}</p>
            <p className="mt-2 max-w-xs text-white/40">{settings.sellerAddress}</p>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-7xl border-t border-white/10 pt-6 text-xs text-white/30">
          <div className="flex items-center gap-2">
            <MessageCircleQuestion size={13} /> Have questions? Use the chat assistant in the corner.
          </div>
        </div>
      </footer>

      <CartDrawer />
      <ChatWidget />
    </div>
  );
}
