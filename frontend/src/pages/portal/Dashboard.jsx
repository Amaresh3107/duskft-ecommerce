import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../../lib/api';
import { customerAuthHeaders } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/pricing';

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-violet-100 text-violet-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

function StatCard({ label, value }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-[#5E6A7D]">{label}</p>
      <p className="mt-2 text-2xl text-[#121826]">{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/customers/dashboard`, { headers: customerAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setData)
      .catch(() => setError('Could not load your dashboard right now. Please refresh or try again shortly.'));
  }, []);

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!data) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Active Orders" value={data.activeOrderCount} />
        <StatCard label="Total Orders" value={data.totalOrders} />
        <StatCard label="Total Spent" value={formatCurrency(data.totalSpent)} />
        <StatCard label="Pieces Ordered" value={data.totalPieces} />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-[#121826]">Recent Orders</h2>
          <Link to="/portal/orders" className="text-xs text-[#0B132B] underline">View all →</Link>
        </div>

        {data.recentOrders.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-[#5E6A7D]">
            No orders yet.{' '}
            <Link to="/catalog" className="text-[#0B132B] underline">Browse the catalog</Link> to place your first one.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-gray-100 rounded-md border border-gray-200 bg-white">
            {data.recentOrders.map((o) => (
              <Link key={o.id} to={`/portal/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 transition-colors hover:bg-black/[0.02]">
                <div>
                  <p className="text-sm font-medium text-[#121826]">{o.orderNumber}</p>
                  <p className="text-xs text-[#5E6A7D]">
                    {new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}
                    {o.items.reduce((sum, i) => sum + (i.quantity || 0), 0)} pieces
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[o.orderStatus] || 'bg-gray-100 text-gray-600'}`}>
                    {o.orderStatus}
                  </span>
                  <span className="text-sm text-[#121826]">{formatCurrency(o.total)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
