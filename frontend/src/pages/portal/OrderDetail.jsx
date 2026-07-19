import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Printer, Check, RotateCcw, Image as ImageIcon } from 'lucide-react';
import { API, resolveImageUrl } from '../../lib/api';
import { customerAuthHeaders } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/pricing';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select';
import { toast } from '../../components/ui/sonner';

const TIMELINE_STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

const RETURN_STATUS_STYLES = {
  requested: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  received: 'bg-violet-100 text-violet-700',
  refunded: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

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

// Request Return / Replacement — only reachable once an order is delivered
// (enforced server-side too, within a 7-day window from delivery).
function ReturnSection({ order, existingReturn, onCreated }) {
  const [reasonCodes, setReasonCodes] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState('');
  const [reasonNotes, setReasonNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [busy, setBusy] = useState(false);

  const openDialog = () => {
    setReasonCode('');
    setReasonNotes('');
    setSelectedItems(order.items.map((_, i) => i));
    setDialogOpen(true);
    if (reasonCodes.length === 0) {
      fetch(`${API}/returns/reason-codes`, { headers: customerAuthHeaders() })
        .then((r) => r.json())
        .then(setReasonCodes)
        .catch(() => {});
    }
  };

  const toggleItem = (i) => {
    setSelectedItems((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  };

  const submit = async () => {
    if (!reasonCode) { toast.error('Select a reason.'); return; }
    if (selectedItems.length === 0) { toast.error('Select at least one item.'); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API}/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...customerAuthHeaders() },
        body: JSON.stringify({
          orderId: order.id,
          reasonCode,
          reasonNotes,
          items: selectedItems.map((i) => order.items[i]),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not submit your request.');
      toast.success('Return request submitted');
      setDialogOpen(false);
      onCreated(data);
    } catch (err) {
      toast.error(typeof err.message === 'string' ? err.message : 'Could not submit your request.');
    } finally {
      setBusy(false);
    }
  };

  if (order.orderStatus !== 'delivered') return null;

  return (
    <div className="rounded-md border border-gray-200 bg-white p-5">
      <h3 className="flex items-center gap-1.5 text-sm font-medium text-[#121826]">
        <RotateCcw size={15} /> Return / Replacement
      </h3>

      {existingReturn ? (
        <div className="mt-2 flex items-center justify-between">
          <p className="text-sm text-[#5E6A7D] capitalize">{existingReturn.reasonCode.replace(/_/g, ' ')}</p>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${RETURN_STATUS_STYLES[existingReturn.status] || 'bg-gray-100 text-gray-600'}`}>
            {existingReturn.status}
          </span>
        </div>
      ) : (
        <>
          <p className="mt-1 text-xs text-[#5E6A7D]">Within 7 days of delivery, you can request a return or replacement for this order.</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={openDialog}>Request Return / Replacement</Button>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Return / Replacement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-[#5E6A7D]">Which items?</label>
              <div className="space-y-1.5 rounded-md border border-gray-200 p-2">
                {order.items.map((item, i) => (
                  <label key={i} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selectedItems.includes(i)} onChange={() => toggleItem(i)} />
                    {[item.color, item.size].filter(Boolean).join(' / ')} · Qty {item.quantity}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5E6A7D]">Reason</label>
              <Select value={reasonCode} onValueChange={setReasonCode}>
                <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
                <SelectContent>
                  {reasonCodes.map((r) => <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5E6A7D]">Additional details (optional)</label>
              <Textarea rows={3} value={reasonNotes} onChange={(e) => setReasonNotes(e.target.value)} />
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={busy}>{busy ? 'Submitting...' : 'Submit Request'}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Artwork proof review — only shown if admin has created a print job for
// this order. Customer can approve/reject once a proof has been sent.
function ArtworkSection({ printJob, onUpdated }) {
  const [busy, setBusy] = useState(false);

  if (!printJob) return null;

  const respond = async (status) => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/print-jobs/${printJob.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...customerAuthHeaders() },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not submit your response.');
      toast.success(status === 'customer_approved' ? 'Proof approved' : 'Proof rejected');
      onUpdated(data);
    } catch (err) {
      toast.error(typeof err.message === 'string' ? err.message : 'Could not submit your response.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-md border p-5 ${printJob.status === 'proof_sent' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
      <h3 className="flex items-center gap-1.5 text-sm font-medium text-[#121826]">
        <ImageIcon size={15} /> Artwork Proof
        {printJob.status === 'proof_sent' && (
          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-800">Action needed</span>
        )}
      </h3>
      <p className="mt-1 text-xs capitalize text-[#5E6A7D]">Status: {printJob.status.replace(/_/g, ' ')}</p>

      {printJob.artworkFiles?.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {printJob.artworkFiles.map((f, i) => (
            <img key={i} src={resolveImageUrl(typeof f === 'string' ? f : f.url)} alt="Artwork" className="aspect-square rounded-md border border-gray-200 object-cover" />
          ))}
        </div>
      )}

      {printJob.status === 'proof_sent' && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => respond('customer_approved')}>Approve Proof</Button>
          <Button size="sm" variant="outline" disabled={busy} className="text-red-500 hover:text-red-600" onClick={() => respond('customer_rejected')}>Reject Proof</Button>
        </div>
      )}
    </div>
  );
}

export default function OrderDetail() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [products, setProducts] = useState({});
  const [existingReturn, setExistingReturn] = useState(null);
  const [printJob, setPrintJob] = useState(null);
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

    fetch(`${API}/returns`, { headers: customerAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((list) => setExistingReturn(list.find((r) => r.orderId === orderId) || null))
      .catch(() => console.error('Could not load return status for this order.'));

    fetch(`${API}/print-jobs`, { headers: customerAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((list) => setPrintJob(list.find((j) => j.orderId === orderId) || null))
      .catch(() => console.error('Could not load artwork proof status for this order.'));
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

      <ArtworkSection printJob={printJob} onUpdated={setPrintJob} />

      <div className="rounded-md border border-gray-200 bg-white">
        {order.items.map((item, i) => {
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

      <ReturnSection order={order} existingReturn={existingReturn} onCreated={setExistingReturn} />
    </div>
  );
}
