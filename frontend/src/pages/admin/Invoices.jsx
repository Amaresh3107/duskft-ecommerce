import { useEffect, useState } from 'react';
import { ChevronRight, Mail, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { toast } from '../../components/ui/sonner';
import { API, formatApiErrorDetail } from '../../lib/api';
import { adminAuthHeaders } from '../../context/AdminAuthContext';
import { formatCurrency } from '../../lib/pricing';

const STATUS_STYLES = {
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
};

const FILTERS = ['all', 'unpaid', 'partial', 'paid'];

export default function Invoices() {
  const [invoices, setInvoices] = useState(null);
  const [customers, setCustomers] = useState({});
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetch(`${API}/invoices`, { headers: adminAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setInvoices)
      .catch(() => setError('Could not load invoices right now. Please refresh or try again shortly.'));
  };

  useEffect(() => {
    load();
    fetch(`${API}/customers`, { headers: adminAuthHeaders() })
      .then((r) => r.json())
      .then((list) => setCustomers(Object.fromEntries(list.map((c) => [c.id, c.name]))))
      .catch(() => {});
  }, []);

  const openInvoice = (inv) => { setSelected(inv); setPaymentAmount(''); };

  const recordPayment = async (e) => {
    e.preventDefault();
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount.'); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({ invoiceId: selected.id, amount, method: 'bank_transfer' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      toast.success('Payment recorded');
      setPaymentAmount('');
      load();
      const refreshed = await fetch(`${API}/invoices/${selected.id}`, { headers: adminAuthHeaders() }).then((r) => r.json());
      setSelected(refreshed);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const emailInvoice = async (inv) => {
    try {
      const res = await fetch(`${API}/invoices/${inv.id}/email`, { method: 'POST', headers: adminAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      toast.success(`Marked as sent to ${data.to} (email dispatch isn't wired up to a mail provider yet)`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!invoices) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  const visible = filter === 'all' ? invoices : invoices.filter((i) => i.status === filter);
  const outstanding = selected ? selected.totalAmount - selected.amountPaid : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-[#121826]">Invoices</h1>
        <p className="mt-0.5 text-sm text-[#5E6A7D]">{invoices.length} total</p>
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
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Outstanding</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((inv) => (
              <TableRow key={inv.id} className="cursor-pointer" onClick={() => openInvoice(inv)}>
                <TableCell>{inv.invoiceNumber}</TableCell>
                <TableCell>{customers[inv.customerId] || '—'}</TableCell>
                <TableCell>{formatCurrency(inv.totalAmount)}</TableCell>
                <TableCell>{formatCurrency(inv.amountPaid)}</TableCell>
                <TableCell>{formatCurrency(inv.totalAmount - inv.amountPaid)}</TableCell>
                <TableCell>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[inv.status] || 'bg-gray-100 text-gray-600'}`}>
                    {inv.status}
                  </span>
                </TableCell>
                <TableCell><ChevronRight size={15} className="text-[#B7BFC9]" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          {selected && (
            <>
              <DialogHeader><DialogTitle>{selected.invoiceNumber}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between"><dt className="text-[#5E6A7D]">Total</dt><dd>{formatCurrency(selected.totalAmount)}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#5E6A7D]">Paid</dt><dd>{formatCurrency(selected.amountPaid)}</dd></div>
                  <div className="flex justify-between border-t border-gray-100 pt-1 font-medium">
                    <dt>Outstanding</dt><dd>{formatCurrency(outstanding)}</dd>
                  </div>
                </dl>

                {outstanding > 0.01 && (
                  <form onSubmit={recordPayment} className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-[#5E6A7D]">Record Payment (₹)</label>
                      <Input type="number" step="0.01" max={outstanding} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                    </div>
                    <Button type="submit" size="sm" disabled={busy}>{busy ? 'Saving...' : 'Record'}</Button>
                  </form>
                )}

                <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                  <Link to={`/invoice/${selected.orderId}`} target="_blank">
                    <Button size="sm" variant="outline" className="gap-1.5"><Printer size={13} /> Print</Button>
                  </Link>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => emailInvoice(selected)}>
                    <Mail size={13} /> Email
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
