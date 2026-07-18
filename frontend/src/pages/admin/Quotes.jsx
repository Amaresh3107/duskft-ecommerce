import { useEffect, useState } from 'react';
import { ChevronRight, ArrowRightCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { toast } from '../../components/ui/sonner';
import { API, formatApiErrorDetail } from '../../lib/api';
import { adminAuthHeaders } from '../../context/AdminAuthContext';
import { formatCurrency } from '../../lib/pricing';

const STATUS_STYLES = {
  draft: 'bg-gray-100 text-gray-600',
  open: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  converted: 'bg-violet-100 text-violet-700',
  lost: 'bg-red-100 text-red-700',
};

const FILTERS = ['all', 'draft', 'open', 'approved', 'converted', 'lost'];
const NEXT_STATUS = { draft: 'open', open: 'approved' };

export default function Quotes() {
  const [quotes, setQuotes] = useState(null);
  const [customers, setCustomers] = useState({});
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetch(`${API}/quotes`, { headers: adminAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setQuotes)
      .catch(() => setError('Could not load quotes right now. Please refresh or try again shortly.'));
  };

  useEffect(() => {
    load();
    fetch(`${API}/customers`, { headers: adminAuthHeaders() })
      .then((r) => r.json())
      .then((list) => setCustomers(Object.fromEntries(list.map((c) => [c.id, c.name]))))
      .catch(() => {});
  }, []);

  const setStatus = async (quote, status) => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/quotes/${quote.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      toast.success(`Quote marked as ${status}`);
      setSelected(data);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const convert = async (quote) => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/quotes/${quote.id}/convert`, { method: 'POST', headers: adminAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      toast.success(`Converted to order ${data.orderNumber}`);
      setSelected(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!quotes) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  const visible = filter === 'all' ? quotes : quotes.filter((q) => q.status === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-[#121826]">Quotations</h1>
        <p className="mt-0.5 text-sm text-[#5E6A7D]">{quotes.length} total</p>
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
              <TableHead>Quote</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Subtotal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((q) => (
              <TableRow key={q.id} className="cursor-pointer" onClick={() => setSelected(q)}>
                <TableCell>{q.quoteNumber}</TableCell>
                <TableCell>{customers[q.customerId] || '—'}</TableCell>
                <TableCell className="text-[#5E6A7D]">
                  {new Date(q.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </TableCell>
                <TableCell>{formatCurrency(q.subtotal)}</TableCell>
                <TableCell>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[q.status] || 'bg-gray-100 text-gray-600'}`}>
                    {q.status}
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
              <DialogHeader><DialogTitle>{selected.quoteNumber}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="rounded-md border border-gray-200 bg-white">
                  {selected.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 text-sm last:border-b-0">
                      <span>{[item.color, item.size].filter(Boolean).join(' / ')} · Qty {item.quantity}</span>
                      <span>{formatCurrency(item.lineTotal)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#5E6A7D]">Subtotal</span>
                  <span className="font-medium text-[#121826]">{formatCurrency(selected.subtotal)}</span>
                </div>
                {selected.notes && <p className="text-sm text-[#5E6A7D]">Note: {selected.notes}</p>}

                <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                  {NEXT_STATUS[selected.status] && (
                    <Button size="sm" disabled={busy} onClick={() => setStatus(selected, NEXT_STATUS[selected.status])} className="capitalize">
                      Mark as {NEXT_STATUS[selected.status]}
                    </Button>
                  )}
                  {selected.status === 'approved' && (
                    <Button size="sm" disabled={busy} onClick={() => convert(selected)} className="gap-1.5">
                      <ArrowRightCircle size={14} /> Convert to Order
                    </Button>
                  )}
                  {!['converted', 'lost'].includes(selected.status) && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus(selected, 'lost')} className="text-red-500 hover:text-red-600">
                      Mark as Lost
                    </Button>
                  )}
                </div>
                {selected.status === 'converted' && (
                  <p className="text-[11px] text-[#B7BFC9]">This quote has been converted to an order and can no longer be changed.</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
