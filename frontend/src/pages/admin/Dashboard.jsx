import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { API } from '../../lib/api';
import { adminAuthHeaders } from '../../context/AdminAuthContext';
import { formatCurrency } from '../../lib/pricing';

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
    fetch(`${API}/dashboard/admin`, { headers: adminAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setData)
      .catch(() => setError('Could not load dashboard data.'));
  }, []);

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!data) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-[#121826]">Dashboard</h1>
        <p className="mt-0.5 text-sm text-[#5E6A7D]">An overview of store performance.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Sales" value={formatCurrency(data.totalSales)} />
        <StatCard label="Open Orders" value={data.openOrders} />
        <StatCard label="Avg. Order Value" value={formatCurrency(data.averageOrderValue)} />
        <StatCard label="Total Orders" value={data.totalOrders} />
      </div>

      <div>
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-[#121826]">
          <AlertTriangle size={15} className="text-amber-500" /> Low Stock Alerts
        </h2>
        {data.lowStockProducts.length === 0 ? (
          <p className="mt-2 text-sm text-[#5E6A7D]">All products are adequately stocked.</p>
        ) : (
          <div className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200 bg-white">
            {data.lowStockProducts.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-[#121826]">{p.name}</span>
                <span className="text-amber-600">{p.stock} left</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 text-sm">
        <Link to="/admin/products" className="text-[#0B132B] underline">Manage Products →</Link>
      </div>
    </div>
  );
}
