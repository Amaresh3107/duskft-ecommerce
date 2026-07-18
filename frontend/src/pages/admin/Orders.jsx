import { useEffect, useState } from 'react';
import { Check, ChevronRight, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { toast } from '../../components/ui/sonner';
import { API, formatApiErrorDetail, resolveImageUrl } from '../../lib/api';
import { adminAuthHeaders } from '../../context/AdminAuthContext';
import { formatCurrency } from '../../lib/pricing';

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-violet-100 text-violet-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

const PIPELINE = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
const FILTERS = ['all', ...PIPELINE, 'cancelled'];

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [categories, setCategories] = useState({});
  const [products, setProducts] = useState({});
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetch(`${API}/orders`, { headers: adminAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setOrders)
      .catch(() => setError('Could not load orders right now. Please refresh or try again shortly.'));
  };

  useEffect(() => {
    load();
    fetch(`${API}/categories?includeInactive=true`, { headers: adminAuthHeaders() })
      .then((r) => r.json())
      .then((list) => setCategories(Object.fromEntries(list.map((c) => [c.id, c.name]))))
      .catch(() => {});
  }, []);

  // Fetch product details (name, image, category) for whichever order is
  // currently open, so the dialog can show what's actually in it — order
  // line items only store productId/color/size/qty, not the product itself.
  useEffect(() => {
    if (!selected) return;
    const missing = [...new Set(selected.items.map((i) => i.productId))].filter((id) => !products[id]);
    if (missing.length === 0) return;
    Promise.all(
      missing.map((id) =>
        fetch(`${API}/products/${id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((p) => [id, p])
          .catch(() => [id, null])
      )
    ).then((entries) => setProducts((prev) => ({ ...prev, ...Object.fromEntries(entries) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const advance = async (order, nextStatus) => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/orders/${order.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      toast.success(`Order marked as ${nextStatus}`);
      setSelected(data);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const generateInvoice = async (order) => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      toast.success(`Invoice ${data.invoiceNumber} ready — see Invoices tab.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!orders) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  const visible = filter === 'all' ? orders : orders.filter((o) => o.orderStatus === filter);
  const nextStatus = selected ? PIPELINE[PIPELINE.indexOf(selected.orderStatus) + 1] : null;
  const canCancel = selected && ['pending', 'confirmed', 'processing'].includes(selected.orderStatus);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-[#121826]">Orders</h1>
        <p className="mt-0.5 text-sm text-[#5E6A7D]">{orders.length} total</p>
      </div>

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

      <div className="rounded-md border border-gray-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((o) => (
              <TableRow key={o.id} className="cursor-pointer" onClick={() => setSelected(o)}>
                <TableCell>{o.orderNumber}</TableCell>
                <TableCell>{o.customerName || o.guestEmail || 'Guest'}</TableCell>
                <TableCell className="text-[#5E6A7D]">
                  {new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </TableCell>
                <TableCell>{formatCurrency(o.total)}</TableCell>
                <TableCell className="capitalize text-[#5E6A7D]">{o.paymentStatus}</TableCell>
                <TableCell>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[o.orderStatus] || 'bg-gray-100 text-gray-600'}`}>
                    {o.orderStatus}
                  </span>
                </TableCell>
                <TableCell><ChevronRight size={15} className="text-[#B7BFC9]" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.orderNumber}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {(() => {
                  const cats = [...new Set(
                    selected.items
                      .map((i) => products[i.productId]?.categoryId)
                      .filter(Boolean)
                      .map((id) => categories[id])
                      .filter(Boolean)
                  )];
                  return cats.length > 0 ? (
                    <div className="-mt-2 flex flex-wrap gap-1.5">
                      {cats.map((c) => (
                        <span key={c} className="rounded-full bg-black/5 px-2.5 py-0.5 text-xs text-[#5E6A7D]">{c}</span>
                      ))}
                    </div>
                  ) : null;
                })()}

                <div className="rounded-md border border-gray-200 bg-white">
                  {selected.items.map((item, i) => {
                    const p = products[item.productId];
                    return (
                      <div key={i} className="flex items-center gap-3 border-b border-gray-100 px-4 py-2.5 last:border-b-0">
                        <img
                          src={resolveImageUrl(p?.images?.[0]) || 'https://placehold.co/40x40?text=%20'}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[#121826]">{p?.name || 'Product'}</p>
                          <p className="text-xs text-[#5E6A7D]">
                            {p?.categoryId && categories[p.categoryId] ? `${categories[p.categoryId]} · ` : ''}
                            {[item.color, item.size].filter(Boolean).join(' / ')} · Qty {item.quantity}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm text-[#121826]">{formatCurrency(item.lineTotal)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="text-sm text-[#5E6A7D]">
                  <p className="font-medium text-[#121826]">Shipping Address</p>
                  <p>
                    {selected.shippingAddress?.line1}
                    {selected.shippingAddress?.line2 ? `, ${selected.shippingAddress.line2}` : ''}<br />
                    {selected.shippingAddress?.city}, {selected.shippingAddress?.state} — {selected.shippingAddress?.pincode}
                  </p>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-[#5E6A7D]">Total</span>
                  <span className="font-medium text-[#121826]">{formatCurrency(selected.total)}</span>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                  {nextStatus && (
                    <Button size="sm" disabled={busy} onClick={() => advance(selected, nextStatus)} className="gap-1.5 capitalize">
                      <Check size={13} /> Mark as {nextStatus}
                    </Button>
                  )}
                  {canCancel && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => advance(selected, 'cancelled')} className="gap-1.5 text-red-500 hover:text-red-600">
                      <X size={13} /> Cancel Order
                    </Button>
                  )}
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => generateInvoice(selected)}>
                    Generate Invoice
                  </Button>
                </div>
                {selected.orderStatus === 'pending' && (
                  <p className="text-[11px] text-[#B7BFC9]">Confirming this order will deduct stock for its items.</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
