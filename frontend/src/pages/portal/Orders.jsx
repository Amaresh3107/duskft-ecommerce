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

const FILTERS = ['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch(`${API}/orders`, { headers: customerAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setOrders)
      .catch(() => setError('Could not load your orders right now. Please refresh or try again shortly.'));
  }, []);

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!orders) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  const visible = filter === 'all' ? orders : orders.filter((o) => o.orderStatus === filter);

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl text-[#121826]">My Orders</h2>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs capitalize transition-colors ${
              filter === f ? 'bg-[#0B132B] text-white' : 'bg-black/5 text-[#5E6A7D] hover:bg-black/10'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-[#5E6A7D]">
          {orders.length === 0 ? (
            <>No orders yet. <Link to="/catalog" className="text-[#0B132B] underline">Browse the catalog</Link> to place your first one.</>
          ) : (
            'No orders match this filter.'
          )}
        </div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-md border border-gray-200 bg-white">
          {visible.map((o) => (
            <Link
              key={o.id}
              to={`/portal/orders/${o.id}`}
              className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 transition-colors hover:bg-black/[0.02]"
            >
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
  );
}
