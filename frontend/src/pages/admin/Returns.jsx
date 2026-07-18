import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { toast } from '../../components/ui/sonner';
import { API, formatApiErrorDetail } from '../../lib/api';
import { adminAuthHeaders } from '../../context/AdminAuthContext';
import { formatCurrency } from '../../lib/pricing';

const STATUS_STYLES = {
  requested: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  received: 'bg-violet-100 text-violet-700',
  refunded: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

const TRANSITIONS = {
  requested: ['approved', 'rejected'],
  approved: ['received', 'rejected'],
  received: ['refunded', 'rejected'],
};

const FILTERS = ['all', 'requested', 'approved', 'received', 'refunded', 'rejected'];

export default function Returns() {
  const [returns, setReturns] = useState(null);
  const [orders, setOrders] = useState({});
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetch(`${API}/returns`, { headers: adminAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setReturns)
      .catch(() => setError('Could not load returns right now. Please refresh or try again shortly.'));
  };

  useEffect(load, []);

  const openReturn = (ret) => {
    setSelected(ret);
    setRefundAmount('');
    if (!orders[ret.orderId]) {
      fetch(`${API}/orders/${ret.orderId}`, { headers: adminAuthHeaders() })
        .then((r) => (r.ok ? r.json() : null))
        .then((o) => o && setOrders((prev) => ({ ...prev, [ret.orderId]: o })))
        .catch(() => {});
    }
  };

  const setStatus = async (ret, status) => {
    if (status === 'refunded' && (!refundAmount || parseFloat(refundAmount) <= 0)) {
      toast.error('Enter a refund amount.');
      return;
    }
    setBusy(true);
    try {
      const body = { status };
      if (status === 'refunded') body.refundAmount = parseFloat(refundAmount);
      const res = await fetch(`${API}/returns/${ret.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      toast.success(`Return marked as ${status}`);
      setSelected(data);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!returns) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  const visible = filter === 'all' ? returns : returns.filter((r) => r.status === filter);
  const order = selected ? orders[selected.orderId] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-[#121826]">Returns / RMA</h1>
        <p className="mt-0.5 text-sm text-[#5E6A7D]">{returns.length} total</p>
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

      {returns.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-[#5E6A7D]">
          No return requests yet. Note: there's no "Request a Return" button in the customer Portal yet —
          returns currently only get created via the API, so this list will stay empty until that's built.
        </div>
      ) : (
        <div className="rounded-md border border-gray-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Ships Paid By</TableHead>
                <TableHead>Refund</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => openReturn(r)}>
                  <TableCell className="text-[#5E6A7D]">{r.orderId.slice(-8)}</TableCell>
                  <TableCell className="capitalize">{r.reasonCode.replace(/_/g, ' ')}</TableCell>
                  <TableCell className="capitalize text-[#5E6A7D]">{r.returnShippingPaidBy}</TableCell>
                  <TableCell>{r.refundAmount > 0 ? formatCurrency(r.refundAmount) : '—'}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[r.status] || 'bg-gray-100 text-gray-600'}`}>
                      {r.status}
                    </span>
                  </TableCell>
                  <TableCell><ChevronRight size={15} className="text-[#B7BFC9]" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          {selected && (
            <>
              <DialogHeader><DialogTitle>Return for {order?.orderNumber || selected.orderId.slice(-8)}</DialogTitle></DialogHeader>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-[#5E6A7D]">Reason</p>
                  <p className="capitalize text-[#121826]">{selected.reasonCode.replace(/_/g, ' ')}</p>
                  {selected.reasonNotes && <p className="mt-1 text-[#5E6A7D]">"{selected.reasonNotes}"</p>}
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5E6A7D]">Return shipping paid by</span>
                  <span className="capitalize">{selected.returnShippingPaidBy}</span>
                </div>
                {selected.items?.length > 0 && (
                  <div className="rounded-md border border-gray-200">
                    {selected.items.map((item, i) => (
                      <div key={i} className="border-b border-gray-100 px-3 py-2 text-xs last:border-b-0">
                        {[item.color, item.size].filter(Boolean).join(' / ')} · Qty {item.quantity}
                      </div>
                    ))}
                  </div>
                )}

                {selected.status === 'received' && (
                  <div>
                    <label className="mb-1 block text-xs text-[#5E6A7D]">Refund Amount (₹)</label>
                    <Input type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
                  </div>
                )}

                <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                  {(TRANSITIONS[selected.status] || []).map((next) => (
                    <Button
                      key={next}
                      size="sm"
                      disabled={busy}
                      variant={next === 'rejected' ? 'outline' : 'default'}
                      className={`capitalize ${next === 'rejected' ? 'text-red-500 hover:text-red-600' : ''}`}
                      onClick={() => setStatus(selected, next)}
                    >
                      Mark as {next}
                    </Button>
                  ))}
                  {!TRANSITIONS[selected.status] && (
                    <p className="text-xs text-[#B7BFC9]">This return is in a final state and can't be changed further.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
