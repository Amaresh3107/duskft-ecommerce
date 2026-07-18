import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
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
};

const TAB_LABELS = { branding: 'Branding', tax_shipping: 'Tax & Shipping', seller: 'Seller Details', ai: 'AI Config' };

export default function Settings() {
  const [values, setValues] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API}/settings`, { headers: adminAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setValues)
      .catch(() => setError('Could not load settings right now. Please refresh or try again shortly.'));
  }, []);

  const save = async () => {
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
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!values) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl text-[#121826]">Settings</h1>
        <p className="mt-0.5 text-sm text-[#5E6A7D]">Admin-only — these apply store-wide.</p>
      </div>

      <Tabs defaultValue="branding">
        <TabsList>
          {Object.keys(FIELD_GROUPS).map((g) => <TabsTrigger key={g} value={g}>{TAB_LABELS[g]}</TabsTrigger>)}
        </TabsList>

        {Object.entries(FIELD_GROUPS).map(([group, fields]) => (
          <TabsContent key={group} value={group} className="space-y-3">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs text-[#5E6A7D]">{f.label}</label>
                {f.textarea ? (
                  <Textarea rows={3} value={values[f.key] || ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                ) : (
                  <Input type={f.type || 'text'} value={values[f.key] || ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                )}
              </div>
            ))}
          </TabsContent>
        ))}
      </Tabs>

      <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</Button>
    </div>
  );
}
