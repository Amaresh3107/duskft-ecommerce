import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from '../components/ui/sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { API, formatApiErrorDetail, resolveImageUrl } from '../lib/api';
import { useAuth, customerAuthHeaders } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { cartTotals, formatCurrency } from '../lib/pricing';
import { CHECKOUT } from '../constants/testIds';

const EMPTY_ADDRESS = { line1: '', line2: '', city: '', state: '', pincode: '' };

export default function Checkout() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { lines, clearCart } = useCart();
  const { priced, subtotal } = cartTotals(lines);

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('new');
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [guest, setGuest] = useState({ guestName: '', guestEmail: '', guestPhone: '' });
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [bankAccounts, setBankAccounts] = useState([]);
  const [publicSettings, setPublicSettings] = useState({});
  const [shippingCost, setShippingCost] = useState(0);
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/settings/public`).then((r) => r.json()).then(setPublicSettings).catch(() => {});
    fetch(`${API}/bank-accounts`).then((r) => r.json()).then(setBankAccounts).catch(() => {});
    if (isAuthenticated) {
      fetch(`${API}/customers/addresses`, { headers: customerAuthHeaders() })
        .then((r) => r.json())
        .then((addrs) => {
          setSavedAddresses(addrs);
          const def = addrs.find((a) => a.isDefault) || addrs[0];
          if (def) {
            setSelectedAddressId(def.id);
            setAddress({ line1: def.line1, line2: def.line2, city: def.city, state: def.state, pincode: def.pincode });
          }
        });
    }
  }, [isAuthenticated]);

  const fetchShipping = useCallback(async (pincode, sub) => {
    if (!pincode) return setShippingCost(0);
    const res = await fetch(`${API}/shipping-zones/calculate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pincode, subtotal: sub }),
    });
    const data = await res.json();
    setShippingCost(data.shippingCost || 0);
  }, []);

  useEffect(() => {
    fetchShipping(address.pincode, subtotal);
  }, [address.pincode, subtotal, fetchShipping]);

  const taxPercent = Number(publicSettings.taxPercent || 0);
  const taxEstimate = Math.round(subtotal * taxPercent) / 100;
  const orderTotal = subtotal + shippingCost + taxEstimate;

  const bankAccount = bankAccounts[0];

  const selectSavedAddress = (id) => {
    setSelectedAddressId(id);
    const found = savedAddresses.find((a) => a.id === id);
    if (found) setAddress({ line1: found.line1, line2: found.line2, city: found.city, state: found.state, pincode: found.pincode });
  };

  const placeOrder = async () => {
    setError('');
    if (lines.length === 0) return setError('Your cart is empty.');
    if (!address.line1 || !address.city || !address.state || !address.pincode) return setError('Please complete the shipping address.');
    if (!isAuthenticated && !guest.guestName) return setError('Please enter your name for guest checkout.');

    setPlacing(true);
    try {
      const payload = {
        items: lines.map((l) => ({ productId: l.productId, color: l.color, size: l.size, quantity: l.quantity })),
        shippingAddress: address,
        paymentMethod,
        notes,
        ...(!isAuthenticated ? guest : {}),
      };
      const res = await fetch(`${API}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(isAuthenticated ? customerAuthHeaders() : {}) },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      sessionStorage.setItem(`order_${data.id}`, JSON.stringify(data));
      clearCart();
      navigate(`/order-confirmation/${data.id}`);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setPlacing(false);
    }
  };

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <p className="text-sm text-[#5E6A7D]">Your cart is empty.</p>
        <Link to="/catalog" className="mt-3 inline-block text-sm text-[#0B132B] underline">Browse catalog</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <h1 className="font-display text-4xl text-[#121826]">Checkout</h1>

      {!isAuthenticated && (
        <p data-testid={CHECKOUT.loginPrompt} className="mt-3 text-sm text-[#5E6A7D]">
          Checking out as a guest. <Link to="/login" className="text-[#0B132B] underline">Log in</Link> to use saved addresses and track this order.
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-10 md:grid-cols-3">
        <div className="space-y-8 md:col-span-2">
          {!isAuthenticated && (
            <section>
              <p className="mb-3 text-xs uppercase tracking-[0.15em] text-[#5E6A7D]">Contact details</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input data-testid={CHECKOUT.guestNameInput} placeholder="Full name" value={guest.guestName} onChange={(e) => setGuest((g) => ({ ...g, guestName: e.target.value }))} />
                <Input data-testid={CHECKOUT.guestEmailInput} placeholder="Email" value={guest.guestEmail} onChange={(e) => setGuest((g) => ({ ...g, guestEmail: e.target.value }))} />
                <Input data-testid={CHECKOUT.guestPhoneInput} placeholder="Phone" value={guest.guestPhone} onChange={(e) => setGuest((g) => ({ ...g, guestPhone: e.target.value }))} />
              </div>
            </section>
          )}

          <section>
            <p className="mb-3 text-xs uppercase tracking-[0.15em] text-[#5E6A7D]">Shipping address</p>
            {isAuthenticated && savedAddresses.length > 0 && (
              <div className="mb-3 space-y-2">
                {savedAddresses.map((a, i) => (
                  <label key={a.id} data-testid={CHECKOUT.savedAddressOption(i)} className={`block cursor-pointer rounded-lg border p-3 text-sm ${selectedAddressId === a.id ? 'border-[#0B132B] bg-[#0B132B]/5' : 'border-black/10'}`}>
                    <input type="radio" className="mr-2" checked={selectedAddressId === a.id} onChange={() => selectSavedAddress(a.id)} />
                    {a.line1}, {a.city}, {a.state} {a.pincode}
                  </label>
                ))}
                <label className={`block cursor-pointer rounded-lg border p-3 text-sm ${selectedAddressId === 'new' ? 'border-[#0B132B] bg-[#0B132B]/5' : 'border-black/10'}`}>
                  <input type="radio" className="mr-2" checked={selectedAddressId === 'new'} onChange={() => { setSelectedAddressId('new'); setAddress(EMPTY_ADDRESS); }} />
                  Use a new address
                </label>
              </div>
            )}
            {(selectedAddressId === 'new' || !isAuthenticated) && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input data-testid={CHECKOUT.addressLine1Input} placeholder="Address line 1" className="sm:col-span-2" value={address.line1} onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))} />
                <Input data-testid={CHECKOUT.addressLine2Input} placeholder="Address line 2 (optional)" className="sm:col-span-2" value={address.line2} onChange={(e) => setAddress((a) => ({ ...a, line2: e.target.value }))} />
                <Input data-testid={CHECKOUT.cityInput} placeholder="City" value={address.city} onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))} />
                <Input data-testid={CHECKOUT.stateInput} placeholder="State" value={address.state} onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))} />
                <Input data-testid={CHECKOUT.pincodeInput} placeholder="Pincode" value={address.pincode} onChange={(e) => setAddress((a) => ({ ...a, pincode: e.target.value }))} />
              </div>
            )}
          </section>

          <section>
            <p className="mb-3 text-xs uppercase tracking-[0.15em] text-[#5E6A7D]">Payment method</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {['cod', 'bank_transfer', 'upi'].map((method) => (
                <button
                  key={method}
                  data-testid={CHECKOUT.paymentMethodOption(method)}
                  onClick={() => setPaymentMethod(method)}
                  className={`rounded-lg border p-3 text-sm font-medium capitalize ${paymentMethod === method ? 'border-[#0B132B] bg-[#0B132B] text-white' : 'border-black/10 text-[#121826]'}`}
                >
                  {method === 'cod' ? 'Cash on Delivery' : method === 'bank_transfer' ? 'Bank Transfer' : 'UPI'}
                </button>
              ))}
            </div>
            {paymentMethod === 'bank_transfer' && bankAccount && (
              <div data-testid={CHECKOUT.bankDetails} className="mt-3 rounded-lg border border-black/10 bg-[#F3F1EC] p-4 text-sm">
                <p><strong>Account name:</strong> {bankAccount.accountName}</p>
                <p><strong>Account number:</strong> {bankAccount.accountNumber}</p>
                <p><strong>IFSC:</strong> {bankAccount.ifsc}</p>
                <p><strong>Bank:</strong> {bankAccount.bankName}</p>
              </div>
            )}
            {paymentMethod === 'upi' && bankAccount && (
              <div data-testid={CHECKOUT.upiDetails} className="mt-3 rounded-lg border border-black/10 bg-[#F3F1EC] p-4 text-sm">
                <p><strong>UPI ID:</strong> {bankAccount.upiId}</p>
                {bankAccount.qrImageUrl && <img src={resolveImageUrl(bankAccount.qrImageUrl)} alt="UPI QR" className="mt-2 h-32 w-32" />}
              </div>
            )}
          </section>

          <section>
            <p className="mb-3 text-xs uppercase tracking-[0.15em] text-[#5E6A7D]">Order notes (optional)</p>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special instructions for this order" />
          </section>

          {error && <p data-testid={CHECKOUT.error} className="text-sm text-[#EF4444]">{error}</p>}
        </div>

        <div className="h-fit rounded-lg border border-black/10 bg-white p-5">
          <p className="mb-3 text-xs uppercase tracking-[0.15em] text-[#5E6A7D]">Order summary</p>
          <div className="space-y-1.5 text-sm">
            {priced.map((l, i) => (
              <div key={i} className="flex justify-between text-[#5E6A7D]">
                <span>{l.name} ({l.color}/{l.size}) × {l.quantity}</span>
                <span>{formatCurrency(l.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1.5 border-t border-black/10 pt-4 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between" data-testid={CHECKOUT.shippingCost}><span>Shipping</span><span>{formatCurrency(shippingCost)}</span></div>
            <div className="flex justify-between text-[#5E6A7D]" data-testid={CHECKOUT.taxEstimate}>
              <span>GST (~{taxPercent}%, exact split shown after order)</span><span>{formatCurrency(taxEstimate)}</span>
            </div>
          </div>
          <div className="mt-4 flex justify-between border-t border-black/10 pt-4 font-display text-xl text-[#121826]" data-testid={CHECKOUT.orderTotal}>
            <span>Total</span><span>{formatCurrency(orderTotal)}</span>
          </div>
          <Button data-testid={CHECKOUT.placeOrderButton} onClick={placeOrder} disabled={placing}
                  className="mt-5 w-full rounded-full bg-[#FF4500] py-6 text-base font-medium text-white hover:bg-[#FF4500]/90">
            {placing ? 'Placing order...' : 'Place Order'}
          </Button>
        </div>
      </div>
    </div>
  );
}
