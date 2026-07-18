import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { toast } from '../../components/ui/sonner';
import { API, formatApiErrorDetail } from '../../lib/api';
import { adminAuthHeaders, useAdminAuth } from '../../context/AdminAuthContext';
import { formatCurrency } from '../../lib/pricing';

const EMPTY_FORM = { id: null, name: '', pincodePrefixes: [], rate: '', freeShippingThreshold: '', estimatedDays: '', active: true };

export default function ShippingZones() {
  const { isAdmin } = useAdminAuth();
  const [zones, setZones] = useState(null);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [prefixDraft, setPrefixDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch(`${API}/shipping-zones?includeInactive=true`, { headers: adminAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setZones)
      .catch(() => setError('Could not load shipping zones right now. Please refresh or try again shortly.'));
  };

  useEffect(load, []);

  const openAdd = () => { setForm(EMPTY_FORM); setPrefixDraft(''); setDialogOpen(true); };
  const openEdit = (z) => { setForm(z); setPrefixDraft(''); setDialogOpen(true); };

  const addPrefix = () => {
    const v = prefixDraft.trim();
    if (v && !form.pincodePrefixes.includes(v)) setForm({ ...form, pincodePrefixes: [...form.pincodePrefixes, v] });
    setPrefixDraft('');
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        rate: parseFloat(form.rate) || 0,
        freeShippingThreshold: parseFloat(form.freeShippingThreshold) || 0,
        estimatedDays: parseInt(form.estimatedDays, 10) || 0,
      };
      const url = form.id ? `${API}/shipping-zones/${form.id}` : `${API}/shipping-zones`;
      const res = await fetch(url, {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      toast.success(form.id ? 'Zone updated' : 'Zone created');
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this shipping zone?')) return;
    try {
      const res = await fetch(`${API}/shipping-zones/${id}`, { method: 'DELETE', headers: adminAuthHeaders() });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Zone deleted');
      load();
    } catch {
      toast.error('Could not delete zone.');
    }
  };

  const toggleActive = async (z) => {
    setZones(zones.map((x) => (x.id === z.id ? { ...x, active: !x.active } : x)));
    try {
      await fetch(`${API}/shipping-zones/${z.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({ active: !z.active }),
      });
    } catch {
      load();
      toast.error('Could not update.');
    }
  };

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!zones) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-[#121826]">Shipping Zones</h1>
          <p className="mt-0.5 text-sm text-[#5E6A7D]">Rates are matched by pincode prefix — most specific match wins.</p>
        </div>
        <Button onClick={openAdd} className="gap-1.5"><Plus size={14} /> Add Zone</Button>
      </div>

      <div className="divide-y divide-gray-100 rounded-md border border-gray-200 bg-white">
        {zones.map((z) => (
          <div key={z.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
            <div className="min-w-[140px] flex-1">
              <p className="text-sm font-medium text-[#121826]">{z.name}</p>
              <p className="text-xs text-[#5E6A7D]">{z.pincodePrefixes.join(', ') || 'No prefixes set'}</p>
            </div>
            <span className="text-sm text-[#121826]">{formatCurrency(z.rate)}</span>
            <span className="text-xs text-[#5E6A7D]">Free above {formatCurrency(z.freeShippingThreshold)}</span>
            <span className="text-xs text-[#5E6A7D]">{z.estimatedDays}d</span>
            <Switch checked={z.active} onCheckedChange={() => toggleActive(z)} />
            <button onClick={() => openEdit(z)} className="text-[#5E6A7D] hover:text-[#121826]"><Pencil size={14} /></button>
            {isAdmin && <button onClick={() => remove(z.id)} className="text-[#5E6A7D] hover:text-red-500"><Trash2 size={14} /></button>}
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? 'Edit Zone' : 'Add Zone'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <Input placeholder="Zone name (e.g. Metro Cities)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />

            <div>
              <label className="mb-1 block text-xs text-[#5E6A7D]">Pincode Prefixes</label>
              <div className="flex flex-wrap gap-1.5 rounded-md border border-gray-300 p-2">
                {form.pincodePrefixes.map((p) => (
                  <span key={p} className="flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-xs">
                    {p}
                    <button type="button" onClick={() => setForm({ ...form, pincodePrefixes: form.pincodePrefixes.filter((x) => x !== p) })}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
                <input
                  value={prefixDraft}
                  onChange={(e) => setPrefixDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addPrefix(); } }}
                  onBlur={addPrefix}
                  placeholder="e.g. 400, 110"
                  className="min-w-[80px] flex-1 border-none text-sm outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[#5E6A7D]">Rate (₹)</label>
                <Input type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} required />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5E6A7D]">Free Above (₹)</label>
                <Input type="number" value={form.freeShippingThreshold} onChange={(e) => setForm({ ...form, freeShippingThreshold: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5E6A7D]">Est. Days</label>
                <Input type="number" value={form.estimatedDays} onChange={(e) => setForm({ ...form, estimatedDays: e.target.value })} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <span className="text-sm text-[#5E6A7D]">Active</span>
            </div>

            <DialogFooter><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Zone'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
