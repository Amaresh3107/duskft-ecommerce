import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { API } from '../lib/api';
import { formatCurrency } from '../lib/pricing';

export default function InvoicePrint() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    const raw = sessionStorage.getItem(`order_${orderId}`);
    if (raw) setOrder(JSON.parse(raw));
    fetch(`${API}/settings/public`).then((r) => r.json()).then(setSettings).catch(() => {});
  }, [orderId]);

  if (!order) {
    return <div className="p-10 text-center text-sm text-[#5E6A7D]">Invoice details are not available on this device.</div>;
  }

  return (
    <div className="min-h-screen bg-[#F9F8F6] py-8">
      <div className="no-print mx-auto mb-4 flex max-w-3xl justify-end px-5">
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-[#0B132B] px-5 py-2.5 text-sm font-medium text-white">
          <Printer size={15} /> Print
        </button>
      </div>

      <div className="invoice-print-area mx-auto max-w-3xl bg-white p-10 font-['IBM_Plex_Sans',sans-serif] text-black">
        <div className="flex items-start justify-between border-b border-black pb-6">
          <div>
            <p className="text-2xl font-semibold">{settings.storeName}</p>
            <p className="mt-1 text-xs text-gray-600">{settings.sellerAddress}</p>
            <p className="text-xs text-gray-600">{settings.sellerPhone} · {settings.sellerEmail}</p>
            {settings.gstNumber && <p className="text-xs text-gray-600">GSTIN: {settings.gstNumber}</p>}
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold uppercase">Invoice</p>
            <p className="text-xs text-gray-600">Order {order.orderNumber}</p>
            <p className="text-xs text-gray-600">{new Date(order.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 text-xs">
          <div>
            <p className="uppercase text-gray-500">Bill To</p>
            <p className="mt-1 font-medium">{order.customerName}</p>
            <p>{order.shippingAddress?.line1}, {order.shippingAddress?.line2}</p>
            <p>{order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.pincode}</p>
          </div>
          <div className="text-right">
            <p className="uppercase text-gray-500">Payment Method</p>
            <p className="mt-1 font-medium capitalize">{order.paymentMethod?.replace('_', ' ')}</p>
            <p className="uppercase text-gray-500">Payment Status</p>
            <p className="font-medium capitalize">{order.paymentStatus}</p>
          </div>
        </div>

        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black text-left text-xs uppercase">
              <th className="py-2">Item</th>
              <th className="py-2">Color/Size</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Unit Price</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={i} className="border-b border-gray-300">
                <td className="py-2">Item {i + 1}</td>
                <td className="py-2">{item.color} / {item.size}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                <td className="py-2 text-right">{formatCurrency(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{formatCurrency(order.shippingCost)}</span></div>
            <div className="flex justify-between"><span>CGST</span><span>{formatCurrency(order.taxBreakdown?.cgst || 0)}</span></div>
            <div className="flex justify-between"><span>SGST</span><span>{formatCurrency(order.taxBreakdown?.sgst || 0)}</span></div>
            <div className="flex justify-between"><span>IGST</span><span>{formatCurrency(order.taxBreakdown?.igst || 0)}</span></div>
            {order.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{formatCurrency(order.discount)}</span></div>}
            <div className="flex justify-between border-t-2 border-black pt-1 text-base font-semibold"><span>Total</span><span>{formatCurrency(order.total)}</span></div>
          </div>
        </div>

        <p className="mt-10 border-t border-gray-300 pt-4 text-center text-[10px] text-gray-500">Thank you for your business. This is a system-generated invoice.</p>
      </div>
    </div>
  );
}
