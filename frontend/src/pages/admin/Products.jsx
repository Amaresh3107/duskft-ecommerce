import { useEffect, useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Search, X, Download, Upload } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { toast } from '../../components/ui/sonner';
import { API, formatApiErrorDetail, resolveImageUrl } from '../../lib/api';
import { adminAuthHeaders, useAdminAuth } from '../../context/AdminAuthContext';
import { ImageUploader } from '../../components/admin/ImageUploader';

const EMPTY_FORM = {
  id: null, sku: '', name: '', categoryId: '', description: '', images: [], videoUrl: '',
  colors: [], sizes: [], tierPricing: [], basePrice: '', moq: 1, totalStock: 0, stock: 0, status: 'active',
};

function TagInput({ label, values, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft('');
  };
  return (
    <div>
      <label className="mb-1 block text-xs text-[#5E6A7D]">{label}</label>
      <div className="flex flex-wrap gap-1.5 rounded-md border border-gray-300 p-2">
        {values.map((v) => (
          <span key={v} className="flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-xs">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}>
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
          onBlur={add}
          placeholder={placeholder}
          className="min-w-[80px] flex-1 border-none text-sm outline-none"
        />
      </div>
    </div>
  );
}

function TierPricingEditor({ tiers, onChange }) {
  const update = (i, field, value) => {
    const next = [...tiers];
    next[i] = { ...next[i], [field]: value };
    onChange(next);
  };
  const remove = (i) => onChange(tiers.filter((_, idx) => idx !== i));
  const add = () => onChange([...tiers, { minQty: '', price: '' }]);

  return (
    <div>
      <label className="mb-1 block text-xs text-[#5E6A7D]">Tier Pricing (higher qty tiers override base price)</label>
      <div className="space-y-2">
        {tiers.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input type="number" placeholder="Min qty" value={t.minQty} onChange={(e) => update(i, 'minQty', e.target.value)} className="w-28" />
            <span className="text-xs text-[#5E6A7D]">units → ₹</span>
            <Input type="number" placeholder="Price" value={t.price} onChange={(e) => update(i, 'price', e.target.value)} className="w-28" />
            <button type="button" onClick={() => remove(i)} className="text-[#5E6A7D] hover:text-red-500"><X size={14} /></button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add} className="mt-2 gap-1"><Plus size={13} /> Add Tier</Button>
    </div>
  );
}

export default function Products() {
  const { isAdmin } = useAdminAuth();
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const fileInputRef = useRef(null);

  const load = () => {
    fetch(`${API}/products?includeInactive=true`, { headers: adminAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setProducts)
      .catch(() => setError('Could not load products right now. Please refresh or try again shortly.'));
  };

  useEffect(() => {
    load();
    fetch(`${API}/categories?includeInactive=true`, { headers: adminAuthHeaders() })
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  const openAdd = () => { setForm(EMPTY_FORM); setDialogOpen(true); };

  const downloadTemplate = async () => {
    try {
      const res = await fetch(`${API}/products/import/template`, { headers: adminAuthHeaders() });
      if (!res.ok) throw new Error('Could not download the template.');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'product_import_template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Selecting a file only stages it — nothing is uploaded until the user
  // explicitly confirms, in case the wrong file gets picked by mistake.
  const selectFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setImportResult(null);
  };

  const cancelImport = () => {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmImport = async () => {
    if (!pendingFile) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', pendingFile);
      const res = await fetch(`${API}/products/import`, {
        method: 'POST',
        headers: adminAuthHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      setImportResult(data);
      if (data.created > 0) load();
      if (data.created > 0 && data.errors.length === 0) toast.success(`Imported ${data.created} products`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setImporting(false);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  const openEdit = (p) => {
    setForm({
      id: p.id, sku: p.sku, name: p.name, categoryId: p.categoryId || '', description: p.description,
      images: p.images || [], videoUrl: p.videoUrl || '', colors: p.colors || [], sizes: p.sizes || [],
      tierPricing: p.tierPricing || [], basePrice: p.basePrice, moq: p.moq, totalStock: p.totalStock, stock: p.stock, status: p.status,
    });
    setDialogOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (parseInt(form.stock, 10) > parseInt(form.totalStock, 10)) {
      toast.error('Current Stock cannot exceed Total Stock.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        basePrice: parseFloat(form.basePrice) || 0,
        moq: parseInt(form.moq, 10) || 1,
        totalStock: parseInt(form.totalStock, 10) || 0,
        stock: parseInt(form.stock, 10) || 0,
        tierPricing: form.tierPricing
          .filter((t) => t.minQty !== '' && t.price !== '')
          .map((t) => ({ minQty: parseInt(t.minQty, 10), price: parseFloat(t.price) })),
      };
      const url = form.id ? `${API}/products/${form.id}` : `${API}/products`;
      const res = await fetch(url, {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      toast.success(form.id ? 'Product updated' : 'Product created');
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this product? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API}/products/${id}`, { method: 'DELETE', headers: adminAuthHeaders() });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Product deleted');
      load();
    } catch {
      toast.error('Could not delete product.');
    }
  };

  const toggleStatus = async (p) => {
    const nextStatus = p.status === 'active' ? 'inactive' : 'active';
    setProducts(products.map((x) => (x.id === p.id ? { ...x, status: nextStatus } : x)));
    try {
      await fetch(`${API}/products/${p.id}`, {
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
  if (!products) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  const visible = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-[#121826]">Products</h1>
          <p className="mt-0.5 text-sm text-[#5E6A7D]">{products.length} total</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => { setImportOpen(true); setImportResult(null); }} className="gap-1.5">
              <Upload size={14} /> Bulk Import
            </Button>
          )}
          <Button onClick={openAdd} className="gap-1.5"><Plus size={14} /> Add Product</Button>
        </div>
      </div>

      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B7BFC9]" />
        <Input placeholder="Search by name or SKU" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
      </div>

      <div className="rounded-md border border-gray-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Base Price</TableHead>
              <TableHead>MOQ</TableHead>
              <TableHead>Total Stock</TableHead>
              <TableHead>Current Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="flex items-center gap-2">
                  <img src={resolveImageUrl(p.images?.[0]) || 'https://placehold.co/40x40?text=%20'} alt="" className="h-9 w-9 rounded object-cover" />
                  <span>{p.name}</span>
                </TableCell>
                <TableCell className="text-[#5E6A7D]">{p.sku || '—'}</TableCell>
                <TableCell>₹{p.basePrice}</TableCell>
                <TableCell>{p.moq}</TableCell>
                <TableCell className="text-[#5E6A7D]">{p.totalStock}</TableCell>
                <TableCell className={p.stock < 15 ? 'font-medium text-amber-600' : ''}>{p.stock}</TableCell>
                <TableCell>
                  <button onClick={() => toggleStatus(p)}>
                    <Badge variant={p.status === 'active' ? 'default' : 'secondary'} className="cursor-pointer capitalize">{p.status}</Badge>
                  </button>
                </TableCell>
                <TableCell className="text-right">
                  <button onClick={() => openEdit(p)} className="mr-3 text-[#5E6A7D] hover:text-[#121826]"><Pencil size={14} /></button>
                  {isAdmin && (
                    <button onClick={() => remove(p.id)} className="text-[#5E6A7D] hover:text-red-500"><Trash2 size={14} /></button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit Product' : 'Add Product'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>

            <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />

            <div>
              <label className="mb-1 block text-xs text-[#5E6A7D]">Images (first = cover, drag to reorder)</label>
              <ImageUploader value={form.images} onChange={(images) => setForm({ ...form, images })} />
            </div>

            <Input placeholder="YouTube video URL (optional)" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} />

            <div className="grid grid-cols-2 gap-3">
              <TagInput label="Colors" values={form.colors} onChange={(colors) => setForm({ ...form, colors })} placeholder="Type & press Enter" />
              <TagInput label="Sizes" values={form.sizes} onChange={(sizes) => setForm({ ...form, sizes })} placeholder="Type & press Enter" />
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[#5E6A7D]">Base Price (₹)</label>
                <Input type="number" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} required />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5E6A7D]">MOQ</label>
                <Input type="number" value={form.moq} onChange={(e) => setForm({ ...form, moq: e.target.value })} required />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5E6A7D]">Total Stock</label>
                <Input type="number" value={form.totalStock} onChange={(e) => setForm({ ...form, totalStock: e.target.value })} required />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5E6A7D]">Current Stock</label>
                <Input type="number" max={form.totalStock} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required />
              </div>
            </div>
            <p className="-mt-2 text-[11px] text-[#B7BFC9]">
              Total Stock is what you originally received. Current Stock is what's left — it auto-decreases when an order is confirmed, so you usually only need to edit it when restocking.
            </p>

            <TierPricingEditor tiers={form.tierPricing} onChange={(tierPricing) => setForm({ ...form, tierPricing })} />

            <div className="flex items-center gap-2">
              <Switch checked={form.status === 'active'} onCheckedChange={(v) => setForm({ ...form, status: v ? 'active' : 'inactive' })} />
              <span className="text-sm text-[#5E6A7D]">Active (visible on storefront)</span>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Product'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Import Products</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[#5E6A7D]">
              Download the template, fill in one row per product, then upload it here. Doesn't affect any existing products — only adds new ones.
            </p>

            <Button variant="outline" onClick={downloadTemplate} className="gap-1.5">
              <Download size={14} /> Download Template (.xlsx)
            </Button>

            <div>
              <label className="mb-1 block text-xs text-[#5E6A7D]">Upload filled-in file</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                onChange={selectFile}
                disabled={importing}
                className="block w-full text-sm text-[#5E6A7D] file:mr-3 file:rounded-full file:border-0 file:bg-[#0B132B] file:px-4 file:py-2 file:text-sm file:text-white"
              />
            </div>

            {pendingFile && !importing && (
              <div className="flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
                <span className="truncate text-[#121826]">Import <strong>{pendingFile.name}</strong>?</span>
                <div className="ml-3 flex shrink-0 gap-2">
                  <Button size="sm" onClick={confirmImport}>Confirm</Button>
                  <Button size="sm" variant="outline" onClick={cancelImport}>Cancel</Button>
                </div>
              </div>
            )}

            {importing && <p className="text-sm text-[#5E6A7D]">Importing...</p>}

            {importResult && (
              <div className="space-y-2 rounded-md border border-gray-200 p-3">
                <p className="text-sm text-[#121826]">
                  <span className="font-medium">{importResult.created}</span> product{importResult.created === 1 ? '' : 's'} imported successfully.
                </p>
                {importResult.errors.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-red-500">{importResult.errors.length} row(s) had errors and were skipped:</p>
                    <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-xs text-[#5E6A7D]">
                      {importResult.errors.map((e, i) => (
                        <li key={i}>Row {e.row} ({e.product || 'unnamed'}): {e.error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] text-[#B7BFC9]">
              Note: image columns accept URLs only — a spreadsheet can't carry actual image files. Add photos afterward via Edit on each product,
              or paste externally-hosted image URLs directly into the sheet.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
