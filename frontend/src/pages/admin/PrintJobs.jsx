import { useEffect, useState } from 'react';
import { Plus, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { toast } from '../../components/ui/sonner';
import { API, formatApiErrorDetail } from '../../lib/api';
import { adminAuthHeaders, useAdminAuth } from '../../context/AdminAuthContext';
import { formatCurrency } from '../../lib/pricing';
import { ImageUploader } from '../../components/admin/ImageUploader';

const STATUSES = ['pending', 'artwork_uploaded', 'proof_sent', 'in_production', 'completed', 'customer_approved', 'customer_rejected'];
const STATUS_STYLES = {
  pending: 'bg-gray-100 text-gray-600',
  artwork_uploaded: 'bg-blue-100 text-blue-700',
  proof_sent: 'bg-amber-100 text-amber-700',
  in_production: 'bg-violet-100 text-violet-700',
  completed: 'bg-emerald-100 text-emerald-700',
  customer_approved: 'bg-emerald-100 text-emerald-700',
  customer_rejected: 'bg-red-100 text-red-700',
};

function AuditTrail({ jobId }) {
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    fetch(`${API}/activity-log?entityType=print_job&entityId=${jobId}`, { headers: adminAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [jobId]);

  if (!entries) return null;

  return (
    <div className="border-t border-gray-100 pt-3">
      <p className="mb-1.5 text-xs font-medium text-[#121826]">Audit Trail</p>
      {entries.length === 0 ? (
        <p className="text-xs text-[#B7BFC9]">No status changes logged yet.</p>
      ) : (
        <ul className="space-y-1">
          {entries.map((e) => (
            <li key={e.id} className="text-xs text-[#5E6A7D]">
              <span className="text-[#B7BFC9]">{new Date(e.createdAt).toLocaleString('en-IN')}</span>
              {' — '}
              {e.action.replace('status_changed:', '').replace('->', ' → ')}
              {e.actorRole ? ` (by ${e.actorRole})` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PrintJobs() {
  const { isAdmin } = useAdminAuth();
  const [jobs, setJobs] = useState(null);
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newOrderId, setNewOrderId] = useState('');
  const [newVendorName, setNewVendorName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetch(`${API}/print-jobs`, { headers: adminAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setJobs)
      .catch(() => setError('Could not load print jobs right now. Please refresh or try again shortly.'));
  };

  const loadVendors = () => {
    fetch(`${API}/vendors`, { headers: adminAuthHeaders() }).then((r) => r.json()).then(setVendors).catch(() => {});
  };

  useEffect(() => {
    load();
    loadVendors();
    fetch(`${API}/orders`, { headers: adminAuthHeaders() }).then((r) => r.json()).then(setOrders).catch(() => {});
  }, []);

  const orderMap = Object.fromEntries(orders.map((o) => [o.id, o]));

  const createJob = async () => {
    if (!newOrderId) { toast.error('Select an order.'); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API}/print-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({ orderId: newOrderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      toast.success('Print job created');
      setCreateOpen(false);
      setNewOrderId('');
      load();
      setSelected(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const addVendor = async () => {
    if (!newVendorName.trim()) return;
    try {
      const res = await fetch(`${API}/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({ name: newVendorName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      setVendors([...vendors, data]);
      setNewVendorName('');
      toast.success('Vendor added');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const update = async (patch) => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/print-jobs/${selected.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      toast.success('Updated');
      setSelected(data);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteJob = async () => {
    if (!window.confirm('Permanently delete this print job? This cannot be undone.')) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/print-jobs/${selected.id}`, { method: 'DELETE', headers: adminAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      toast.success('Print job deleted');
      setSelected(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!jobs) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  const availableOrders = orders.filter((o) => !jobs.some((j) => j.orderId === o.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-[#121826]">Print Jobs & Artwork</h1>
          <p className="mt-0.5 text-sm text-[#5E6A7D]">{jobs.length} total</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus size={14} /> New Print Job</Button>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-[#5E6A7D]">
          No print jobs yet. Create one against an order that needs custom artwork.
        </div>
      ) : (
        <div className="rounded-md border border-gray-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Vendor Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id} className="cursor-pointer" onClick={() => setSelected(j)}>
                  <TableCell>{orderMap[j.orderId]?.orderNumber || j.orderId.slice(-8)}</TableCell>
                  <TableCell className="text-[#5E6A7D]">{vendors.find((v) => v.id === j.vendorId)?.name || '—'}</TableCell>
                  <TableCell>{j.vendorCost > 0 ? formatCurrency(j.vendorCost) : '—'}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[j.status] || 'bg-gray-100 text-gray-600'}`}>
                      {j.status.replace(/_/g, ' ')}
                    </span>
                  </TableCell>
                  <TableCell><ChevronRight size={15} className="text-[#B7BFC9]" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create print job */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Print Job</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={newOrderId} onValueChange={setNewOrderId}>
              <SelectTrigger><SelectValue placeholder="Select an order" /></SelectTrigger>
              <SelectContent>
                {availableOrders.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.orderNumber} — {o.customerName || o.guestEmail}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button onClick={createJob} disabled={busy}>{busy ? 'Creating...' : 'Create'}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Job detail */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle>{orderMap[selected.orderId]?.orderNumber || 'Print Job'}</DialogTitle>
                  {isAdmin && (
                    <button onClick={deleteJob} disabled={busy} className="flex items-center gap-1 text-xs text-[#5E6A7D] hover:text-red-500">
                      <Trash2 size={13} /> Delete
                    </button>
                  )}
                </div>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs text-[#5E6A7D]">Status</label>
                  <Select value={selected.status} onValueChange={(status) => update({ status })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-[#5E6A7D]">Artwork Files</label>
                  <ImageUploader
                    value={(selected.artworkFiles || []).map((f) => (typeof f === 'string' ? f : f.url))}
                    onChange={(urls) => update({ artworkFiles: urls.map((url) => ({ url })), status: 'artwork_uploaded' })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-[#5E6A7D]">Vendor</label>
                    <Select value={selected.vendorId || ''} onValueChange={(vendorId) => update({ vendorId })}>
                      <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                      <SelectContent>
                        {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[#5E6A7D]">Vendor Cost (₹)</label>
                    <Input type="number" defaultValue={selected.vendorCost} onBlur={(e) => update({ vendorCost: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>

                <div className="flex items-end gap-2 border-t border-gray-100 pt-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-[#5E6A7D]">Add a new vendor</label>
                    <Input value={newVendorName} onChange={(e) => setNewVendorName(e.target.value)} placeholder="Vendor name" />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addVendor}>Add</Button>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-[#5E6A7D]">Notes</label>
                  <Textarea defaultValue={selected.notes} onBlur={(e) => update({ notes: e.target.value })} rows={2} />
                </div>

                <p className="text-[11px] text-[#B7BFC9]">
                  "Customer Approved / Rejected" is normally set by the customer once a proof is sent — you can also set it here manually if needed.
                </p>

                <AuditTrail jobId={selected.id} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
