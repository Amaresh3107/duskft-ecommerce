import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { API, resolveImageUrl } from '../../lib/api';
import { adminAuthHeaders } from '../../context/AdminAuthContext';
import { formatCurrency } from '../../lib/pricing';

const STATUS_COLORS = {
  pending: '#F59E0B', confirmed: '#3B82F6', processing: '#3B82F6',
  shipped: '#8B5CF6', delivered: '#10B981', cancelled: '#EF4444',
};
const SOURCE_COLORS = { cart: '#0B132B', quote: '#FF4500' };
const PERIODS = ['daily', 'weekly', 'monthly', 'yearly'];

function StatCard({ label, value }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-[#5E6A7D]">{label}</p>
      <p className="mt-2 text-2xl text-[#121826]">{value}</p>
    </div>
  );
}

function ChartCard({ title, className = '', children }) {
  return (
    <div className={`rounded-md border border-gray-200 bg-white p-5 ${className}`}>
      <h3 className="mb-4 text-sm font-medium text-[#121826]">{title}</h3>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [sales, setSales] = useState(null);
  const [topProducts, setTopProducts] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [period, setPeriod] = useState('daily');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/dashboard/admin`, { headers: adminAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setData)
      .catch(() => setError('Could not load dashboard data.'));
    fetch(`${API}/dashboard/top-products?limit=6`, { headers: adminAuthHeaders() })
      .then((r) => r.json()).then(setTopProducts).catch(() => setTopProducts([]));
    fetch(`${API}/dashboard/order-breakdown`, { headers: adminAuthHeaders() })
      .then((r) => r.json()).then(setBreakdown).catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API}/dashboard/sales-over-time?period=${period}`, { headers: adminAuthHeaders() })
      .then((r) => r.json()).then(setSales).catch(() => {});
  }, [period]);

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!data) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  const maxQty = topProducts && topProducts.length > 0 ? Math.max(...topProducts.map((p) => p.quantity)) : 1;

  return (
    <div className="space-y-6">
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

      {/* Row 1: Sales Over Time (wide) + Top Selling Items with images (narrow) */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Sales Over Time" className="lg:col-span-2">
          <div className="mb-3 flex gap-2">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-full px-3 py-1 text-xs capitalize transition-colors ${
                  period === p ? 'bg-[#0B132B] text-white' : 'bg-black/5 text-[#5E6A7D] hover:bg-black/10'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          {sales && sales.series.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={sales.series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, name) => (name === 'revenue' ? formatCurrency(v) : v)} />
                <Line type="monotone" dataKey="revenue" stroke="#FF4500" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-16 text-center text-sm text-[#5E6A7D]">No sales data for this period yet.</p>
          )}
        </ChartCard>

        <ChartCard title="Top Selling Items">
          {topProducts && topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={p.productId} className="flex items-center gap-2.5">
                  <span className="w-4 shrink-0 text-xs text-[#B7BFC9]">{i + 1}</span>
                  <img
                    src={resolveImageUrl(p.image) || 'https://placehold.co/40x40?text=%20'}
                    alt={p.name}
                    className="h-9 w-9 shrink-0 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-[#121826]">{p.name}</p>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
                      <div className="h-full rounded-full bg-[#0B132B]" style={{ width: `${Math.max(6, (p.quantity / maxQty) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-[#5E6A7D]">{p.quantity}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-[#5E6A7D]">No confirmed orders yet.</p>
          )}
        </ChartCard>
      </div>

      {/* Row 2: Order Status Breakdown + Cart vs Quotation */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ChartCard title="Order Status Breakdown">
          {breakdown && breakdown.statusBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={breakdown.statusBreakdown} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={({ status, count }) => `${status} (${count})`}>
                  {breakdown.statusBreakdown.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#B7BFC9'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-sm text-[#5E6A7D]">No orders yet.</p>
          )}
        </ChartCard>

        <ChartCard title="Cart Orders vs. Quotation Orders">
          {breakdown && breakdown.sourceBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={breakdown.sourceBreakdown} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={80}
                     label={({ source, count }) => `${source} (${count})`}>
                  {breakdown.sourceBreakdown.map((entry) => (
                    <Cell key={entry.source} fill={SOURCE_COLORS[entry.source] || '#B7BFC9'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-sm text-[#5E6A7D]">No orders yet.</p>
          )}
        </ChartCard>
      </div>

      {/* Row 3: Revenue by Category + Low Stock Alerts */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ChartCard title="Revenue by Category">
          {breakdown && breakdown.categoryRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, breakdown.categoryRevenue.length * 40)}>
              <BarChart data={breakdown.categoryRevenue} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="revenue" fill="#FF4500" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-sm text-[#5E6A7D]">No revenue yet.</p>
          )}
        </ChartCard>

        <ChartCard title="Low Stock Alerts">
          {data.lowStockProducts.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#5E6A7D]">All products are adequately stocked.</p>
          ) : (
            <div className="max-h-[220px] divide-y divide-gray-100 overflow-y-auto">
              {data.lowStockProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="flex items-center gap-1.5 text-[#121826]">
                    <AlertTriangle size={13} className={p.critical ? 'text-red-500' : 'text-amber-500'} />
                    {p.name}
                  </span>
                  <span className={`font-medium ${p.critical ? 'text-red-600' : 'text-amber-600'}`}>
                    {p.critical ? `${p.stock} (out of stock)` : `${p.stock} left`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      <div className="flex gap-3 text-sm">
        <Link to="/admin/products" className="text-[#0B132B] underline">Manage Products →</Link>
      </div>
    </div>
  );
}
