import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { toast } from '../../components/ui/sonner';
import { API, formatApiErrorDetail, resolveImageUrl } from '../../lib/api';
import { adminAuthHeaders, useAdminAuth } from '../../context/AdminAuthContext';
import { ImageUploader } from '../../components/admin/ImageUploader';

const EMPTY_FORM = { id: null, accountName: '', accountNumber: '', ifsc: '', bankName: '', upiId: '', qrImageUrl: '', active: true };

export default function BankAccounts() {
  const { isAdmin } = useAdminAuth();
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch(`${API}/bank-accounts?includeInactive=true`, { headers: adminAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setAccounts)
      .catch(() => setError('Could not load bank accounts right now. Please refresh or try again shortly.'));
  };

  useEffect(load, []);

  const openAdd = () => { setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (a) => { setForm(a); setDialogOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = form.id ? `${API}/bank-accounts/${form.id}` : `${API}/bank-accounts`;
      const res = await fetch(url, {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      toast.success(form.id ? 'Account updated' : 'Account added');
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this bank account?')) return;
    try {
      const res = await fetch(`${API}/bank-accounts/${id}`, { method: 'DELETE', headers: adminAuthHeaders() });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Deleted');
      load();
    } catch {
      toast.error('Could not delete.');
    }
  };

  const toggleActive = async (a) => {
    setAccounts(accounts.map((x) => (x.id === a.id ? { ...x, active: !x.active } : x)));
    try {
      await fetch(`${API}/bank-accounts/${a.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({ active: !a.active }),
      });
    } catch {
      load();
      toast.error('Could not update.');
    }
  };

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!accounts) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-[#121826]">Bank Accounts</h1>
          <p className="mt-0.5 text-sm text-[#5E6A7D]">Shown to customers as payment options at checkout.</p>
        </div>
        {isAdmin && <Button onClick={openAdd} className="gap-1.5"><Plus size={14} /> Add Account</Button>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {accounts.map((a) => (
          <div key={a.id} className="rounded-md border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#121826]">{a.accountName}</p>
                <p className="text-xs text-[#5E6A7D]">{a.bankName}</p>
              </div>
              {isAdmin && <Switch checked={a.active} onCheckedChange={() => toggleActive(a)} />}
            </div>
            <dl className="mt-2 space-y-0.5 text-xs text-[#5E6A7D]">
              <div>A/C: {a.accountNumber}</div>
              {a.ifsc && <div>IFSC: {a.ifsc}</div>}
              {a.upiId && <div>UPI: {a.upiId}</div>}
            </dl>
            {a.qrImageUrl && <img src={resolveImageUrl(a.qrImageUrl)} alt="QR" className="mt-2 h-20 w-20 rounded object-cover" />}
            {isAdmin && (
              <div className="mt-3 flex gap-3 text-xs">
                <button onClick={() => openEdit(a)} className="inline-flex items-center gap-1 text-[#5E6A7D] hover:text-[#121826]"><Pencil size={12} /> Edit</button>
                <button onClick={() => remove(a.id)} className="inline-flex items-center gap-1 text-[#5E6A7D] hover:text-red-500"><Trash2 size={12} /> Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? 'Edit Bank Account' : 'Add Bank Account'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <Input placeholder="Account holder name" value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} required />
            <Input placeholder="Account number" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} required />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="IFSC" value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value })} />
              <Input placeholder="Bank name" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
            </div>
            <Input placeholder="UPI ID (optional)" value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })} />
            <div>
              <label className="mb-1 block text-xs text-[#5E6A7D]">QR Code Image (optional)</label>
              <ImageUploader value={form.qrImageUrl ? [form.qrImageUrl] : []} onChange={(imgs) => setForm({ ...form, qrImageUrl: imgs[0] || '' })} multiple={false} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <span className="text-sm text-[#5E6A7D]">Active</span>
            </div>
            <DialogFooter><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
