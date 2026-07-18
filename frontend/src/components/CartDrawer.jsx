import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Button } from './ui/button';
import { useCart, lineKey } from '../context/CartContext';
import { cartTotals, moqStatusByProduct, formatCurrency } from '../lib/pricing';
import { resolveImageUrl } from '../lib/api';
import { CART } from '../constants/testIds';

export const CartDrawer = () => {
  const { lines, updateQuantity, removeLine, drawerOpen, setDrawerOpen } = useCart();
  const { priced, subtotal } = cartTotals(lines);
  const moqStatus = moqStatusByProduct(lines);
  const unmetProducts = Object.entries(moqStatus).filter(([, s]) => !s.met);

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent data-testid={CART.drawer} className="flex w-full flex-col gap-0 border-l border-black/10 bg-[#F9F8F6] p-0 sm:max-w-md">
        <SheetHeader className="border-b border-black/5 p-5 text-left">
          <SheetTitle className="font-display text-2xl text-[#121826]">Your Cart</SheetTitle>
        </SheetHeader>

        {priced.length === 0 ? (
          <div data-testid={CART.emptyState} className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
            <ShoppingBag size={36} className="text-[#5E6A7D]/40" />
            <p className="text-sm text-[#5E6A7D]">Your cart is empty. Browse the catalog to start a bulk order.</p>
            <Button asChild onClick={() => setDrawerOpen(false)} className="mt-2 rounded-full bg-[#0B132B] text-white hover:bg-[#0B132B]/90">
              <Link to="/catalog">Browse Catalog</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {unmetProducts.map(([productId, s]) => (
                <div key={productId} data-testid={CART.moqWarning(productId)} className="rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-2 text-xs text-[#7a5205]">
                  "{s.name}" needs {s.moq} units minimum — you have {s.qty}. Add {s.moq - s.qty} more to meet MOQ.
                </div>
              ))}
              {priced.map((l, i) => (
                <div key={lineKey(l)} data-testid={CART.line(i)} className="flex gap-3 border-b border-black/5 pb-4">
                  <img src={resolveImageUrl(l.image)} alt={l.name} className="h-16 w-16 rounded-md object-cover" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#121826]">{l.name}</p>
                    <p className="text-xs text-[#5E6A7D]">{l.color} / {l.size}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1 rounded-full border border-black/10 bg-white">
                        <button onClick={() => updateQuantity(lineKey(l), l.quantity - 1)} className="p-1.5 text-[#121826] hover:text-[#FF4500]">
                          <Minus size={13} />
                        </button>
                        <input
                          data-testid={CART.qtyInput(i)}
                          type="number"
                          value={l.quantity}
                          onChange={(e) => updateQuantity(lineKey(l), parseInt(e.target.value || '0', 10))}
                          className="w-10 border-none bg-transparent text-center text-sm outline-none"
                        />
                        <button onClick={() => updateQuantity(lineKey(l), l.quantity + 1)} className="p-1.5 text-[#121826] hover:text-[#FF4500]">
                          <Plus size={13} />
                        </button>
                      </div>
                      <p className="text-sm font-semibold text-[#121826]">{formatCurrency(l.lineTotal)}</p>
                    </div>
                  </div>
                  <button data-testid={CART.removeButton(i)} onClick={() => removeLine(lineKey(l))} className="self-start text-[#5E6A7D] hover:text-[#EF4444]">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <div className="border-t border-black/5 bg-white p-5">
              <div className="mb-3 flex items-center justify-between text-sm text-[#5E6A7D]">
                <span>Subtotal</span>
                <span data-testid={CART.subtotal} className="text-lg font-semibold text-[#121826]">{formatCurrency(subtotal)}</span>
              </div>
              <p className="mb-3 text-xs text-[#5E6A7D]">Shipping and tax calculated at checkout.</p>
              <Button asChild data-testid={CART.checkoutButton} onClick={() => setDrawerOpen(false)}
                      className="w-full rounded-full bg-[#FF4500] py-6 text-base font-medium text-white hover:bg-[#FF4500]/90">
                <Link to="/checkout">Proceed to Checkout</Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
