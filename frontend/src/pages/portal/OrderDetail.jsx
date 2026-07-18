import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Printer, Check } from 'lucide-react';
import { API } from '../../lib/api';
import { customerAuthHeaders } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/pricing';

const TIMELINE_STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

function StatusTimeline({ status }) {
  if (status === 'cancelled') {
    return <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">This order was cancelled.</p>;
  }
  const currentIndex = TIMELINE_STEPS.indexOf(status);
  return (
    <div className="flex items-center">
      {TIMELINE_STEPS.map((step, i) => {
        const done = i <= currentIndex;
        return (
          <div key={step} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                  done ? 'bg-[#0B132B] text-white' : 'bg-gray-200 text-gray-400'
                }`}
              >
                {done ? <Check size={14} /> : i + 1}
              </div>
              <span className={`mt-1 whitespace-nowrap text-[11px] capitalize ${done ? 'text-[#121826]' : 'text-[#B7BFC9]'}`}>{step}</span>
            </div>
            {i < TIMELINE_STEPS.length - 1 && (
              <div className={`mx-1 h-0.5 flex-1 ${i < currentIndex ? 'bg-[#0B132B]' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OrderDetail() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [products, setProducts] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/orders/${orderId}`, { headers: customerAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(async (data) => {
        setOrder(data);
        const uniqueIds = [...new Set(data.items.map((i) => i.productId))];
        const entries = await Promise.all(
          uniqueIds.map((id) =>
            fetch(`${API}/products/${id}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((p) => [id, p])
              .catch(() => [id, null])
          )
        );
        setProducts(Object.fromEntries(entries));
      })
      .catch(() => setError('Could not load this order. It may not exist, or you may not have access to it.'));
  }, [orderId]);

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!order) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  const addr = order.shippingAddress || {};

  return (
    <div className="space-y-6">
      <Link to="/portal/orders" className="inline-flex items-center gap-1 text-sm text-[#5E6A7D] hover:text-[#121826]">
        <ChevronLeft size={16} /> Back to My Orders
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-[#121826]">{order.orderNumber}</h2>
          <p className="text-xs text-[#5E6A7D]">
            Placed {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <Link
          to={`/invoice/${order.id}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-4 py-2 text-xs hover:bg-black/5"
        >
          <Printer size={14} /> Print Invoice
        </Link>
      </div>

      <div className="rounded-md border border-gray-200 bg-white p-5">
        <StatusTimeline status={order.orderStatus} />
      </div>

      <div className="rounded-md border border-gray-200 bg-white">
        {order.items.map((item, i) => {
          const p = products[item.productId];
          return (
            <div key={i} className="flex items-center gap-4 border-b border-gray-100 px-5 py-4 last:border-b-0">
              <img
                src={p?.images?.[0] || 'https://placehold.co/64x64?text=%20'}
                alt={p?.name || 'Product'}
                className="h-14 w-14 rounded-md object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#121826]">{p?.name || 'Product'}</p>
                <p className="text-xs text-[#5E6A7D]">
                  {[item.color, item.size].filter(Boolean).join(' / ')} · Qty {item.quantity}
                </p>
              </div>
              <p className="text-sm text-[#121826]">{formatCurrency(item.lineTotal)}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-md border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-medium text-[#121826]">Shipping Address</h3>
          <p className="mt-2 text-sm text-[#5E6A7D]">
            {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}<br />
            {addr.city}, {addr.state} — {addr.pincode}
          </p>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-medium text-[#121826]">Order Summary</h3>
          <dl className="mt-2 space-y-1 text-sm text-[#5E6A7D]">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatCurrency(order.subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Shipping</dt><dd>{formatCurrency(order.shippingCost)}</dd></div>
            <div className="flex justify-between"><dt>Tax</dt><dd>{formatCurrency(order.tax)}</dd></div>
            {order.discount > 0 && (
              <div className="flex justify-between"><dt>Discount</dt><dd>-{formatCurrency(order.discount)}</dd></div>
            )}
            <div className="flex justify-between border-t border-gray-100 pt-1 font-medium text-[#121826]">
              <dt>Total</dt><dd>{formatCurrency(order.total)}</dd>
            </div>
            <div className="flex justify-between pt-1"><dt>Payment</dt><dd className="capitalize">{order.paymentMethod} · {order.paymentStatus}</dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}
