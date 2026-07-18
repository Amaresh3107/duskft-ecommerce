import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, MapPin, Check } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { toast } from '../../components/ui/sonner';
import { API, formatApiErrorDetail } from '../../lib/api';
import { customerAuthHeaders } from '../../context/AuthContext';

const EMPTY_FORM = { id: null, label: 'Home', line1: '', line2: '', city: '', state: '', pincode: '', isDefault: false };

export default function Addresses() {
  const [addresses, setAddresses] = useState(null);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch(`${API}/customers/addresses`, { headers: customerAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setAddresses)
      .catch(() => setError('Could not load your addresses right now. Please refresh or try again shortly.'));
  };

  useEffect(load, []);

  const openAdd = () => { setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (addr) => { setForm(addr); setDialogOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API}/customers/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...customerAuthHeaders() },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      toast.success(form.id ? 'Address updated' : 'Address added');
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this address?')) return;
    const prev = addresses;
    setAddresses(addresses.filter((a) => a.id !== id));
    try {
      const res = await fetch(`${API}/customers/addresses/${id}`, { method: 'DELETE', headers: customerAuthHeaders() });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Address deleted');
    } catch {
      setAddresses(prev);
      toast.error('Could not delete address. Please try again.');
    }
  };

  const makeDefault = async (addr) => {
    try {
      const res = await fetch(`${API}/customers/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...customerAuthHeaders() },
        body: JSON.stringify({ ...addr, isDefault: true }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success('Default address updated');
      load();
    } catch {
      toast.error('Could not set default address. Please try again.');
    }
  };

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!addresses) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-[#121826]">Saved Addresses</h2>
        <Button size="sm" onClick={openAdd} className="gap-1.5"><Plus size={14} /> Add Address</Button>
      </div>

      {addresses.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-[#5E6A7D]">
          No saved addresses yet. Add one so checkout can fill it in automatically.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((addr) => (
            <div key={addr.id} className="relative rounded-md border border-gray-200 bg-white p-4">
              {addr.isDefault && (
                <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  <Check size={10} /> Default
                </span>
              )}
              <div className="flex items-start gap-2">
                <MapPin size={16} className="mt-0.5 shrink-0 text-[#5E6A7D]" />
                <div>
                  <p className="text-sm font-medium text-[#121826]">{addr.label}</p>
                  <p className="mt-0.5 text-sm text-[#5E6A7D]">
                    {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}<br />
                    {addr.city}, {addr.state} — {addr.pincode}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-3 text-xs">
                <button onClick={() => openEdit(addr)} className="inline-flex items-center gap-1 text-[#5E6A7D] hover:text-[#121826]">
                  <Pencil size={12} /> Edit
                </button>
                <button onClick={() => remove(addr.id)} className="inline-flex items-center gap-1 text-[#5E6A7D] hover:text-red-500">
                  <Trash2 size={12} /> Delete
                </button>
                {!addr.isDefault && (
                  <button onClick={() => makeDefault(addr)} className="ml-auto text-[#0B132B] underline">
                    Set as default
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit Address' : 'Add Address'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <Input placeholder="Label (e.g. Home, Warehouse)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
            <Input placeholder="Address line 1" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} required />
            <Input placeholder="Address line 2 (optional)" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
              <Input placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} required />
            </div>
            <Input placeholder="Pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} required />
            <label className="flex items-center gap-2 text-sm text-[#5E6A7D]">
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
              Set as default address
            </label>
            <DialogFooter>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Address'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
