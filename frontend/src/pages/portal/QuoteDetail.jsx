import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { API, resolveImageUrl } from '../../lib/api';
import { customerAuthHeaders } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/pricing';

const STATUS_STYLES = {
  draft: 'bg-gray-100 text-gray-600',
  open: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  converted: 'bg-violet-100 text-violet-700',
  lost: 'bg-red-100 text-red-700',
};

const STATUS_NOTE = {
  open: "We've received your quote request and are reviewing it — you'll see this update once pricing is confirmed.",
  approved: "This quote has been approved. We'll follow up to get your order placed — no action needed from you here yet.",
  converted: 'This quote has been converted into an order. Check My Orders for its status.',
  lost: 'This quote is no longer active.',
};

export default function QuoteDetail() {
  const { quoteId } = useParams();
  const [quote, setQuote] = useState(null);
  const [products, setProducts] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/quotes/${quoteId}`, { headers: customerAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(async (data) => {
        setQuote(data);
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
      .catch(() => setError('Could not load this quote. It may not exist, or you may not have access to it.'));
  }, [quoteId]);

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!quote) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  return (
    <div className="space-y-6">
      <Link to="/portal/quotes" className="inline-flex items-center gap-1 text-sm text-[#5E6A7D] hover:text-[#121826]">
        <ChevronLeft size={16} /> Back to My Quotes
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-[#121826]">{quote.quoteNumber}</h2>
          <p className="text-xs text-[#5E6A7D]">
            Requested {new Date(quote.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[quote.status] || 'bg-gray-100 text-gray-600'}`}>
          {quote.status}
        </span>
      </div>

      {STATUS_NOTE[quote.status] && (
        <div className="rounded-md bg-black/5 px-4 py-3 text-sm text-[#5E6A7D]">{STATUS_NOTE[quote.status]}</div>
      )}

      <div className="rounded-md border border-gray-200 bg-white">
        {quote.items.map((item, i) => {
          const p = products[item.productId];
          return (
            <div key={i} className="flex items-center gap-4 border-b border-gray-100 px-5 py-4 last:border-b-0">
              <img
                src={resolveImageUrl(p?.images?.[0]) || 'https://placehold.co/64x64?text=%20'}
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

      <div className="flex justify-end">
        <div className="w-48 text-sm">
          <div className="flex justify-between font-medium text-[#121826]">
            <span>Subtotal</span>
            <span>{formatCurrency(quote.subtotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
