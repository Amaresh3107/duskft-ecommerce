import { useEffect, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { toast } from '../../components/ui/sonner';
import { API, formatApiErrorDetail } from '../../lib/api';
import { adminAuthHeaders } from '../../context/AdminAuthContext';

const FIELD_GROUPS = {
  branding: [
    { key: 'storeName', label: 'Store Name' },
    { key: 'currencySymbol', label: 'Currency Symbol' },
    { key: 'currency', label: 'Currency Code' },
  ],
  tax_shipping: [
    { key: 'taxPercent', label: 'Tax Percent (%)', type: 'number' },
    { key: 'freeShippingThreshold', label: 'Free Shipping Threshold (₹)', type: 'number' },
    { key: 'lowStockThresholdPercent', label: 'Low Stock Alert Threshold (% of Total Stock)', type: 'number' },
    { key: 'shippingPolicyText', label: 'Shipping Policy Text', textarea: true },
    { key: 'returnPolicyText', label: 'Return Policy Text', textarea: true },
  ],
  seller: [
    { key: 'sellerState', label: 'Seller State (for GST split)' },
    { key: 'gstNumber', label: 'GST Number' },
    { key: 'sellerAddress', label: 'Seller Address', textarea: true },
    { key: 'sellerPhone', label: 'Seller Phone' },
    { key: 'sellerEmail', label: 'Seller Email' },
    { key: 'whatsappNumber', label: 'WhatsApp Number' },
  ],
  ai: [
    { key: 'geminiApiKey', label: 'Gemini API Key', type: 'password' },
    { key: 'geminiModel', label: 'Gemini Model' },
    { key: 'aiSystemPrompt', label: 'AI System Prompt', textarea: true },
  ],
  email: [
    { key: 'smtpHost', label: 'SMTP Host (e.g. smtp.gmail.com)' },
    { key: 'smtpPort', label: 'SMTP Port (587 for Gmail/Outlook)', type: 'number' },
    { key: 'smtpUser', label: 'SMTP Username (your email address)' },
    { key: 'smtpPassword', label: 'SMTP App Password', type: 'password' },
  ],
  quotations: [
    { key: 'quotationsEnabled', label: 'Enable Quotation Requests', type: 'switch' },
    { key: 'quotationMinQty', label: 'Minimum Quantity (pieces)', type: 'number' },
    { key: 'quotationMinPrice', label: 'Minimum Subtotal (₹)', type: 'number' },
    { key: 'quotationRequireBoth', label: 'Require Both Thresholds (not just one)', type: 'switch' },
  ],
};

const TAB_LABELS = { branding: 'Branding', tax_shipping: 'Tax & Shipping', seller: 'Seller Details', ai: 'AI Config', email: 'Email (SMTP)', quotations: 'Quotations' };

export default function Settings() {
  const [values, setValues] = useState(null);
  const [original, setOriginal] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API}/settings`, { headers: adminAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => { setValues(data); setOriginal(data); })
      .catch(() => setError('Could not load settings right now. Please refresh or try again shortly.'));
  }, []);

  const save = async (group) => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      setValues(data);
      setOriginal(data);
      setEditingGroup(null);
      toast.success(`${TAB_LABELS[group]} saved`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setValues(original);
    setEditingGroup(null);
  };

  // Switching tabs mid-edit would leave an ambiguous half-edited state, so
  // any unsaved edits are discarded when the tab changes.
  const handleTabChange = () => {
    if (editingGroup) cancelEdit();
  };

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!values) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl text-[#121826]">Settings</h1>
        <p className="mt-0.5 text-sm text-[#5E6A7D]">Admin-only — these apply store-wide.</p>
      </div>

      <Tabs defaultValue="branding" onValueChange={handleTabChange}>
        <TabsList>
          {Object.keys(FIELD_GROUPS).map((g) => <TabsTrigger key={g} value={g}>{TAB_LABELS[g]}</TabsTrigger>)}
        </TabsList>

        {Object.entries(FIELD_GROUPS).map(([group, fields]) => {
          const isEditing = editingGroup === group;
          return (
            <TabsContent key={group} value={group} className="space-y-3">
              <div className="flex justify-end">
                {!isEditing && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingGroup(group)} className="gap-1.5">
                    <Pencil size={13} /> Edit
                  </Button>
                )}
              </div>

              {group === 'email' && (
                <p className="rounded-md bg-black/5 px-3 py-2 text-xs text-[#5E6A7D]">
                  For Gmail: use smtp.gmail.com, port 587, and an{' '}
                  <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline">
                    App Password
                  </a>{' '}
                  (not your regular password — requires 2-Step Verification on the account). For Outlook: smtp.office365.com, port 587.
                </p>
              )}
              {group === 'quotations' && (
                <p className="rounded-md bg-black/5 px-3 py-2 text-xs text-[#5E6A7D]">
                  "Request a Quote" only appears to a customer once their cart meets the threshold(s) below. Fill in at least one of
                  Minimum Quantity / Minimum Subtotal — leave the other blank to ignore it, unless "Require Both" is on, in which case both are needed.
                </p>
              )}
              {fields.map((f) => (
                <div key={f.key}>
                  {f.type === 'switch' ? (
                    <div className="flex items-center gap-2">
                      <Switch checked={!!values[f.key]} disabled={!isEditing} onCheckedChange={(v) => setValues({ ...values, [f.key]: v })} />
                      <span className="text-sm text-[#5E6A7D]">{f.label}</span>
                    </div>
                  ) : (
                    <>
                      <label className="mb-1 block text-xs text-[#5E6A7D]">{f.label}</label>
                      {f.textarea ? (
                        <Textarea rows={3} disabled={!isEditing} value={values[f.key] || ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                      ) : (
                        <Input type={f.type || 'text'} disabled={!isEditing} value={values[f.key] || ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                      )}
                    </>
                  )}
                </div>
              ))}

              {isEditing && (
                <div className="flex gap-2 pt-1">
                  <Button onClick={() => save(group)} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
                  <Button type="button" variant="outline" onClick={cancelEdit} disabled={saving} className="gap-1.5">
                    <X size={13} /> Cancel
                  </Button>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
