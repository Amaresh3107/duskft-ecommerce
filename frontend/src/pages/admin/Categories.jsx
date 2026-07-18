import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { toast } from '../../components/ui/sonner';
import { API, formatApiErrorDetail, resolveImageUrl } from '../../lib/api';
import { adminAuthHeaders, useAdminAuth } from '../../context/AdminAuthContext';
import { ImageUploader } from '../../components/admin/ImageUploader';

const EMPTY_CATEGORY = { id: null, name: '', imageUrl: '', sortOrder: 0, active: true };
const EMPTY_BANNER = { id: null, imageUrl: '', link: '', sortOrder: 0, active: true };

function useCrud(endpoint, emptyForm) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch(`${API}/${endpoint}?includeInactive=true`, { headers: adminAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setItems(data.sort((a, b) => a.sortOrder - b.sortOrder)))
      .catch(() => setError(`Could not load ${endpoint} right now. Please refresh or try again shortly.`));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => { setForm({ ...emptyForm, sortOrder: items?.length || 0 }); setDialogOpen(true); };
  const openEdit = (item) => { setForm(item); setDialogOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = form.id ? `${API}/${endpoint}/${form.id}` : `${API}/${endpoint}`;
      const res = await fetch(url, {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({ ...form, sortOrder: parseInt(form.sortOrder, 10) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      toast.success(form.id ? 'Saved' : 'Created');
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API}/${endpoint}/${id}`, { method: 'DELETE', headers: adminAuthHeaders() });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Deleted');
      load();
    } catch {
      toast.error('Could not delete. It may be referenced elsewhere.');
    }
  };

  const toggleActive = async (item) => {
    setItems(items.map((x) => (x.id === item.id ? { ...x, active: !x.active } : x)));
    try {
      await fetch(`${API}/${endpoint}/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({ active: !item.active }),
      });
    } catch {
      load();
      toast.error('Could not update.');
    }
  };

  return { items, error, dialogOpen, setDialogOpen, form, setForm, saving, openAdd, openEdit, save, remove, toggleActive };
}

function CategoriesTab() {
  const { isAdmin } = useAdminAuth();
  const c = useCrud('categories', EMPTY_CATEGORY);
  if (c.error) return <p className="text-sm text-red-500">{c.error}</p>;
  if (!c.items) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={c.openAdd} className="gap-1.5" size="sm"><Plus size={14} /> Add Category</Button></div>
      <div className="divide-y divide-gray-100 rounded-md border border-gray-200 bg-white">
        {c.items.map((cat) => (
          <div key={cat.id} className="flex items-center gap-3 px-4 py-3">
            <GripVertical size={14} className="text-[#B7BFC9]" />
            <img src={resolveImageUrl(cat.imageUrl) || 'https://placehold.co/32x32?text=%20'} alt="" className="h-8 w-8 rounded object-cover" />
            <span className="flex-1 text-sm text-[#121826]">{cat.name}</span>
            <Switch checked={cat.active} onCheckedChange={() => c.toggleActive(cat)} />
            <button onClick={() => c.openEdit(cat)} className="text-[#5E6A7D] hover:text-[#121826]"><Pencil size={14} /></button>
            {isAdmin && <button onClick={() => c.remove(cat.id)} className="text-[#5E6A7D] hover:text-red-500"><Trash2 size={14} /></button>}
          </div>
        ))}
      </div>

      <Dialog open={c.dialogOpen} onOpenChange={c.setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{c.form.id ? 'Edit Category' : 'Add Category'}</DialogTitle></DialogHeader>
          <form onSubmit={c.save} className="space-y-3">
            <Input placeholder="Category name" value={c.form.name} onChange={(e) => c.setForm({ ...c.form, name: e.target.value })} required />
            <div>
              <label className="mb-1 block text-xs text-[#5E6A7D]">Image</label>
              <ImageUploader
                value={c.form.imageUrl ? [c.form.imageUrl] : []}
                onChange={(imgs) => c.setForm({ ...c.form, imageUrl: imgs[0] || '' })}
                multiple={false}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5E6A7D]">Sort Order</label>
              <Input type="number" value={c.form.sortOrder} onChange={(e) => c.setForm({ ...c.form, sortOrder: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={c.form.active} onCheckedChange={(v) => c.setForm({ ...c.form, active: v })} />
              <span className="text-sm text-[#5E6A7D]">Active</span>
            </div>
            <DialogFooter><Button type="submit" disabled={c.saving}>{c.saving ? 'Saving...' : 'Save'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BannersTab() {
  const { isAdmin } = useAdminAuth();
  const b = useCrud('banners', EMPTY_BANNER);
  if (b.error) return <p className="text-sm text-red-500">{b.error}</p>;
  if (!b.items) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={b.openAdd} className="gap-1.5" size="sm"><Plus size={14} /> Add Banner</Button></div>
      <div className="divide-y divide-gray-100 rounded-md border border-gray-200 bg-white">
        {b.items.map((banner) => (
          <div key={banner.id} className="flex items-center gap-3 px-4 py-3">
            <GripVertical size={14} className="text-[#B7BFC9]" />
            <img src={resolveImageUrl(banner.imageUrl)} alt="" className="h-8 w-14 rounded object-cover" />
            <span className="flex-1 truncate text-sm text-[#5E6A7D]">{banner.link || 'No link'}</span>
            <Switch checked={banner.active} onCheckedChange={() => b.toggleActive(banner)} />
            <button onClick={() => b.openEdit(banner)} className="text-[#5E6A7D] hover:text-[#121826]"><Pencil size={14} /></button>
            {isAdmin && <button onClick={() => b.remove(banner.id)} className="text-[#5E6A7D] hover:text-red-500"><Trash2 size={14} /></button>}
          </div>
        ))}
      </div>

      <Dialog open={b.dialogOpen} onOpenChange={b.setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{b.form.id ? 'Edit Banner' : 'Add Banner'}</DialogTitle></DialogHeader>
          <form onSubmit={b.save} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-[#5E6A7D]">Image</label>
              <ImageUploader
                value={b.form.imageUrl ? [b.form.imageUrl] : []}
                onChange={(imgs) => b.setForm({ ...b.form, imageUrl: imgs[0] || '' })}
                multiple={false}
              />
            </div>
            <Input placeholder="Link URL (optional)" value={b.form.link} onChange={(e) => b.setForm({ ...b.form, link: e.target.value })} />
            <div>
              <label className="mb-1 block text-xs text-[#5E6A7D]">Sort Order</label>
              <Input type="number" value={b.form.sortOrder} onChange={(e) => b.setForm({ ...b.form, sortOrder: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={b.form.active} onCheckedChange={(v) => b.setForm({ ...b.form, active: v })} />
              <span className="text-sm text-[#5E6A7D]">Active</span>
            </div>
            <DialogFooter><Button type="submit" disabled={b.saving}>{b.saving ? 'Saving...' : 'Save'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Categories() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-[#121826]">Categories & Banners</h1>
        <p className="mt-0.5 text-sm text-[#5E6A7D]">Storefront navigation and homepage banners.</p>
      </div>
      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="banners">Banners</TabsTrigger>
        </TabsList>
        <TabsContent value="categories"><CategoriesTab /></TabsContent>
        <TabsContent value="banners"><BannersTab /></TabsContent>
      </Tabs>
    </div>
  );
}
