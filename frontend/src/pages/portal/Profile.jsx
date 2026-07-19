import { useEffect, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { toast } from '../../components/ui/sonner';
import { API, formatApiErrorDetail } from '../../lib/api';
import { customerAuthHeaders, useAuth } from '../../context/AuthContext';

export default function Profile() {
  const { updateUser } = useAuth();
  const [form, setForm] = useState(null);
  const [original, setOriginal] = useState(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch(`${API}/customers/me`, { headers: customerAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => {
        const shaped = { name: data.name, phone: data.phone, businessName: data.businessName, gstNumber: data.gstNumber, email: data.email };
        setForm(shaped);
        setOriginal(shaped);
      })
      .catch(() => setError('Could not load your profile right now. Please refresh or try again shortly.'));
  };

  useEffect(load, []);

  const startEdit = () => setEditing(true);
  const cancelEdit = () => { setForm(original); setEditing(false); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API}/customers/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...customerAuthHeaders() },
        body: JSON.stringify({ name: form.name, phone: form.phone, businessName: form.businessName, gstNumber: form.gstNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      updateUser({ name: data.name, phone: data.phone, businessName: data.businessName, gstNumber: data.gstNumber });
      const shaped = { ...form, name: data.name, phone: data.phone, businessName: data.businessName, gstNumber: data.gstNumber };
      setForm(shaped);
      setOriginal(shaped);
      setEditing(false);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!form) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-[#121826]">Profile</h2>
        {!editing && (
          <Button type="button" variant="outline" size="sm" onClick={startEdit} className="gap-1.5">
            <Pencil size={13} /> Edit
          </Button>
        )}
      </div>

      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-[#5E6A7D]">Email</label>
          <Input value={form.email} disabled className="bg-black/[0.03] text-[#B7BFC9]" />
          <p className="mt-1 text-[11px] text-[#B7BFC9]">Email can't be changed here.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#5E6A7D]">Full Name</label>
          <Input value={form.name} disabled={!editing} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#5E6A7D]">Phone</label>
          <Input
            type="tel"
            value={form.phone}
            disabled={!editing}
            onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
            pattern="[6-9][0-9]{9}"
            title="Enter a valid 10-digit mobile number"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#5E6A7D]">Business Name</label>
          <Input value={form.businessName} disabled={!editing} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#5E6A7D]">GST Number</label>
          <Input value={form.gstNumber} disabled={!editing} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
        </div>
        {editing && (
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
            <Button type="button" variant="outline" onClick={cancelEdit} disabled={saving} className="gap-1.5">
              <X size={13} /> Cancel
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
