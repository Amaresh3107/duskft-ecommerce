import { useEffect, useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { toast } from '../../components/ui/sonner';
import { API, formatApiErrorDetail } from '../../lib/api';
import { adminAuthHeaders } from '../../context/AdminAuthContext';

const EMPTY_STAFF_FORM = { id: null, name: '', email: '', password: '', role: 'staff', status: 'active' };

function StaffTab() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_STAFF_FORM);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch(`${API}/users`, { headers: adminAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setUsers)
      .catch(() => setError('Could not load staff accounts right now. Please refresh or try again shortly.'));
  };

  useEffect(load, []);

  const openAdd = () => { setForm(EMPTY_STAFF_FORM); setDialogOpen(true); };
  const openEdit = (u) => { setForm({ id: u.id, name: u.name, email: u.email, password: '', role: u.role, status: u.status }); setDialogOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = form.id ? `${API}/users/${form.id}` : `${API}/users`;
      const payload = form.id
        ? { name: form.name, role: form.role, status: form.status, ...(form.password ? { password: form.password } : {}) }
        : { name: form.name, email: form.email, password: form.password, role: form.role };
      const res = await fetch(url, {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      toast.success(form.id ? 'Account updated' : 'Account created');
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (u) => {
    const nextStatus = u.status === 'active' ? 'inactive' : 'active';
    const prev = users;
    setUsers(users.map((x) => (x.id === u.id ? { ...x, status: nextStatus } : x)));
    try {
      const res = await fetch(`${API}/users/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
    } catch (err) {
      setUsers(prev);
      toast.error(err.message);
    }
  };

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!users) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button size="sm" onClick={openAdd} className="gap-1.5"><Plus size={14} /> Add Staff/Admin</Button></div>
      <div className="rounded-md border border-gray-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell className="text-[#5E6A7D]">{u.email}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{u.role}</Badge></TableCell>
                <TableCell>
                  <button onClick={() => toggleStatus(u)}>
                    <Badge variant={u.status === 'active' ? 'default' : 'secondary'} className="cursor-pointer capitalize">{u.status}</Badge>
                  </button>
                </TableCell>
                <TableCell className="text-right">
                  <button onClick={() => openEdit(u)} className="text-[#5E6A7D] hover:text-[#121826]"><Pencil size={14} /></button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? 'Edit Account' : 'Add Staff/Admin Account'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <Input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input type="email" placeholder="Email" value={form.email} disabled={!!form.id} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <Input
              type="password"
              placeholder={form.id ? 'New password (leave blank to keep current)' : 'Password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!form.id}
            />
            <Select value={form.role} onValueChange={(role) => setForm({ ...form, role })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <DialogFooter><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomersTab() {
  const [customers, setCustomers] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    fetch(`${API}/customers`, { headers: adminAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setCustomers)
      .catch(() => setError('Could not load customers right now. Please refresh or try again shortly.'));
  };

  useEffect(load, []);

  const toggleStatus = async (c) => {
    const nextStatus = c.status === 'active' ? 'inactive' : 'active';
    setCustomers(customers.map((x) => (x.id === c.id ? { ...x, status: nextStatus } : x)));
    try {
      await fetch(`${API}/customers/${c.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({ status: nextStatus }),
      });
    } catch {
      load();
      toast.error('Could not update status.');
    }
  };

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!customers) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  return (
    <div className="rounded-md border border-gray-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Business</TableHead>
            <TableHead>GST</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((c) => (
            <TableRow key={c.id}>
              <TableCell>{c.name}</TableCell>
              <TableCell className="text-[#5E6A7D]">{c.email}</TableCell>
              <TableCell className="text-[#5E6A7D]">{c.businessName || '—'}</TableCell>
              <TableCell className="text-[#5E6A7D]">{c.gstNumber || '—'}</TableCell>
              <TableCell>
                <button onClick={() => toggleStatus(c)}>
                  <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="cursor-pointer capitalize">{c.status}</Badge>
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function UserManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-[#121826]">User Management</h1>
        <p className="mt-0.5 text-sm text-[#5E6A7D]">Admin-only.</p>
      </div>
      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff">Staff & Admins</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
        </TabsList>
        <TabsContent value="staff"><StaffTab /></TabsContent>
        <TabsContent value="customers"><CustomersTab /></TabsContent>
      </Tabs>
    </div>
  );
}
