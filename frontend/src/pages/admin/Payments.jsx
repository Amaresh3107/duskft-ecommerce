import { useEffect, useState } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { API } from '../../lib/api';
import { adminAuthHeaders } from '../../context/AdminAuthContext';
import { formatCurrency } from '../../lib/pricing';

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-[#5E6A7D]">{label}</p>
      <p className="mt-2 text-2xl text-[#121826]">{value}</p>
    </div>
  );
}

export default function Payments() {
  const [payments, setPayments] = useState(null);
  const [invoices, setInvoices] = useState({});
  const [customers, setCustomers] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch(`${API}/payments`, { headers: adminAuthHeaders() }).then((r) => (r.ok ? r.json() : Promise.reject(r))),
      fetch(`${API}/invoices`, { headers: adminAuthHeaders() }).then((r) => (r.ok ? r.json() : Promise.reject(r))),
      fetch(`${API}/customers`, { headers: adminAuthHeaders() }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([paymentsList, invoicesList, customersList]) => {
        setPayments(paymentsList);
        setInvoices(Object.fromEntries(invoicesList.map((i) => [i.id, i])));
        setCustomers(Object.fromEntries(customersList.map((c) => [c.id, c.name])));
      })
      .catch(() => setError('Could not load the payments ledger right now. Please refresh or try again shortly.'));
  }, []);

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!payments) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  const invoiceList = Object.values(invoices);
  const totalInvoiced = invoiceList.reduce((sum, i) => sum + i.totalAmount, 0);
  const totalPaid = invoiceList.reduce((sum, i) => sum + i.amountPaid, 0);
  const outstanding = totalInvoiced - totalPaid;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-[#121826]">Payments Ledger</h1>
        <p className="mt-0.5 text-sm text-[#5E6A7D]">All recorded payments against invoices.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Total Invoiced" value={formatCurrency(totalInvoiced)} />
        <SummaryCard label="Total Paid" value={formatCurrency(totalPaid)} />
        <SummaryCard label="Outstanding Balance" value={formatCurrency(outstanding)} />
      </div>

      <div className="rounded-md border border-gray-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-[#5E6A7D]">No payments recorded yet.</TableCell></TableRow>
            ) : (
              payments.map((p) => {
                const inv = invoices[p.invoiceId];
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-[#5E6A7D]">
                      {new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell>{inv?.invoiceNumber || '—'}</TableCell>
                    <TableCell>{customers[inv?.customerId] || '—'}</TableCell>
                    <TableCell className="capitalize text-[#5E6A7D]">{p.method.replace('_', ' ')}</TableCell>
                    <TableCell className="text-[#5E6A7D]">{p.reference || '—'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.amount)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
