import { useEffect, useState } from 'react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { toast } from '../../components/ui/sonner';
import { API, formatApiErrorDetail } from '../../lib/api';
import { customerAuthHeaders, useAuth } from '../../context/AuthContext';

export default function Profile() {
  const { updateUser } = useAuth();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API}/customers/me`, { headers: customerAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setForm({ name: data.name, phone: data.phone, businessName: data.businessName, gstNumber: data.gstNumber, email: data.email }))
      .catch(() => setError('Could not load your profile right now. Please refresh or try again shortly.'));
  }, []);

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
      <h2 className="font-display text-xl text-[#121826]">Profile</h2>

      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-[#5E6A7D]">Email</label>
          <Input value={form.email} disabled className="bg-black/[0.03] text-[#B7BFC9]" />
          <p className="mt-1 text-[11px] text-[#B7BFC9]">Email can't be changed here.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#5E6A7D]">Full Name</label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#5E6A7D]">Phone</label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#5E6A7D]">Business Name</label>
          <Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#5E6A7D]">GST Number</label>
          <Input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
        </div>
        <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
      </form>
    </div>
  );
}
