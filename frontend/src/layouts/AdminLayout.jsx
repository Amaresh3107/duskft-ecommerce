import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import {
  LayoutDashboard, Package, FolderTree, FileText, ClipboardList, Receipt, Wallet,
  Undo2, Palette, MapPinned, Landmark, Settings as SettingsIcon, Users, BrainCircuit, LogOut,
} from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';

// Grouped to match the Phase 5 build plan. `enabled: false` items render as
// "Coming soon" until their batch is built — same pattern as PortalLayout.
// `adminOnly: true` items are hidden entirely for staff (FR-8: only Admin
// gets Settings & User Management; the backend already enforces this too).
const NAV_GROUPS = [
  {
    label: 'Overview & Catalog',
    items: [
      { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, enabled: true },
      { to: '/admin/products', label: 'Products', icon: Package, enabled: true },
      { to: '/admin/categories', label: 'Categories & Banners', icon: FolderTree, enabled: true },
    ],
  },
  {
    label: 'Sales Pipeline',
    items: [
      { to: '/admin/orders', label: 'Orders', icon: ClipboardList, enabled: true },
      { to: '/admin/quotes', label: 'Quotations', icon: FileText, enabled: true },
      { to: '/admin/invoices', label: 'Invoices', icon: Receipt, enabled: true },
      { to: '/admin/payments', label: 'Payments Ledger', icon: Wallet, enabled: true },
    ],
  },
  {
    label: 'Post-Sale Ops',
    items: [
      { to: '/admin/returns', label: 'Returns / RMA', icon: Undo2, enabled: true },
      { to: '/admin/print-jobs', label: 'Print Jobs & Artwork', icon: Palette, enabled: true },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { to: '/admin/shipping-zones', label: 'Shipping Zones', icon: MapPinned, enabled: true },
      { to: '/admin/bank-accounts', label: 'Bank Accounts', icon: Landmark, enabled: true },
      { to: '/admin/settings', label: 'Settings', icon: SettingsIcon, enabled: true, adminOnly: true },
    ],
  },
  {
    label: 'Access & AI',
    items: [
      { to: '/admin/users', label: 'User Management', icon: Users, enabled: false, adminOnly: true },
      { to: '/admin/knowledge-base', label: 'Knowledge Base', icon: BrainCircuit, enabled: false },
    ],
  },
];

export default function AdminLayout() {
  const { user, isAuthenticated, ready, isAdmin, logout } = useAdminAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !isAuthenticated) navigate('/admin/login');
  }, [ready, isAuthenticated, navigate]);

  if (!ready) return null;
  if (!isAuthenticated) return null;

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="flex min-h-screen bg-[#F5F6F8]">
      <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="px-5 py-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#5E6A7D]">Admin Panel</p>
          <p className="font-display mt-0.5 text-lg text-[#121826]">Antigravity</p>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => !item.adminOnly || isAdmin);
            if (items.length === 0) return null;
            return (
              <div key={group.label}>
                <p className="px-2 text-[10px] font-medium uppercase tracking-wide text-[#B7BFC9]">{group.label}</p>
                <div className="mt-1 space-y-0.5">
                  {items.map(({ to, label, icon: Icon, enabled }) =>
                    enabled ? (
                      <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                          `flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                            isActive ? 'bg-[#0B132B] text-white' : 'text-[#3A4356] hover:bg-black/5'
                          }`
                        }
                      >
                        <Icon size={15} /> {label}
                      </NavLink>
                    ) : (
                      <span
                        key={to}
                        title="Coming soon"
                        className="flex cursor-not-allowed items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-[#C3CAD4]"
                      >
                        <Icon size={15} /> {label}
                      </span>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 px-5 py-4">
          <p className="truncate text-sm text-[#121826]">{user?.name}</p>
          <p className="truncate text-xs capitalize text-[#5E6A7D]">{user?.role}</p>
          <button onClick={handleLogout} className="mt-2 flex items-center gap-1.5 text-xs text-[#5E6A7D] hover:text-red-500">
            <LogOut size={13} /> Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
