import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, Printer } from 'lucide-react';
import { Button } from '../components/ui/button';
import { API } from '../lib/api';
import { useAuth, customerAuthHeaders } from '../context/AuthContext';
import { formatCurrency } from '../lib/pricing';
import { ORDER_CONFIRM } from '../constants/testIds';

export default function OrderConfirmation() {
  const { orderId } = useParams();
  const { isAuthenticated } = useAuth();
  const [order, setOrder] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setNotFound(false);
    const raw = sessionStorage.getItem(`order_${orderId}`);
    if (raw) {
      setOrder(JSON.parse(raw));
      return;
    }
    // Fall back to the API for logged-in customers (e.g. page refresh, revisit, new tab).
    // Guests have no lookup token in this MVP, so they only get the sessionStorage copy.
    if (isAuthenticated) {
      fetch(`${API}/orders/${orderId}`, { headers: customerAuthHeaders() })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => {
          setOrder(data);
          sessionStorage.setItem(`order_${orderId}`, JSON.stringify(data));
        })
        .catch(() => setNotFound(true));
    } else {
      setNotFound(true);
    }
  }, [orderId, isAuthenticated]);

  if (!order) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <p className="text-sm text-[#5E6A7D]">
          {notFound
            ? "We couldn't find that order's details on this device. If you're a registered customer, check your Portal order history."
            : 'Loading order...'}
        </p>
        {notFound && <Link to="/catalog" className="mt-3 inline-block text-sm text-[#0B132B] underline">Continue shopping</Link>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-16 text-center sm:px-8">
      <CheckCircle2 size={48} className="mx-auto text-[#10B981]" />
      <h1 className="font-display mt-4 text-3xl text-[#121826]">Order placed successfully</h1>
      <p className="mt-2 text-sm text-[#5E6A7D]">
        Order <span data-testid={ORDER_CONFIRM.orderNumber} className="font-medium text-[#121826]">{order.orderNumber}</span> has been received.
        We'll be in touch with confirmation and shipping details.
      </p>

      <div className="mt-8 rounded-lg border border-black/10 bg-white p-6 text-left text-sm">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between border-b border-black/5 py-2 last:border-0">
            <span>{item.color} / {item.size} × {item.quantity}</span>
            <span>{formatCurrency(item.lineTotal)}</span>
          </div>
        ))}
        <div className="mt-3 space-y-1 border-t border-black/10 pt-3">
          <div className="flex justify-between text-[#5E6A7D]"><span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
          <div className="flex justify-between text-[#5E6A7D]"><span>Shipping</span><span>{formatCurrency(order.shippingCost)}</span></div>
          <div className="flex justify-between text-[#5E6A7D]"><span>Tax (CGST {formatCurrency(order.taxBreakdown?.cgst || 0)} + SGST {formatCurrency(order.taxBreakdown?.sgst || 0)} + IGST {formatCurrency(order.taxBreakdown?.igst || 0)})</span><span>{formatCurrency(order.tax)}</span></div>
          <div className="flex justify-between font-display text-lg text-[#121826]"><span>Total</span><span>{formatCurrency(order.total)}</span></div>
        </div>
      </div>

      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Button asChild data-testid={ORDER_CONFIRM.printInvoiceButton} variant="outline" className="gap-2 rounded-full border-[#0B132B]">
          <Link to={`/invoice/${order.id}`}>
            <Printer size={16} /> Print Invoice
          </Link>
        </Button>
        <Button asChild data-testid={ORDER_CONFIRM.continueShoppingButton} className="rounded-full bg-[#0B132B] text-white hover:bg-[#0B132B]/90">
          <Link to="/catalog">Continue Shopping</Link>
        </Button>
      </div>
    </div>
  );
}
