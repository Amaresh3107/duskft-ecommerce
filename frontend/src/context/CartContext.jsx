import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

function cartKey(customerId) {
  return customerId ? `cart_items:${customerId}` : 'cart_items:guest';
}

function loadCart(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function mergeLines(a, b) {
  const next = [...a];
  b.forEach((nl) => {
    const idx = next.findIndex((l) => lineKey(l) === lineKey(nl));
    if (idx >= 0) next[idx] = { ...next[idx], quantity: next[idx].quantity + nl.quantity };
    else next.push(nl);
  });
  return next;
}

export function lineKey(l) {
  return `${l.productId}__${l.color}__${l.size}`;
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const customerId = user?.id || null;

  const [lines, setLines] = useState(() => loadCart(cartKey(null)));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const prevCustomerId = useRef(customerId);
  const isFirstRun = useRef(true);

  // Switches which cart is "active" whenever login state changes — this is
  // the actual fix: cart is no longer one global localStorage key shared by
  // everyone who touches the browser.
  useEffect(() => {
    // On mount (including a plain page refresh while already logged in),
    // just load the cart that matches whoever's currently signed in — this
    // is NOT a login event, so it must never trigger the merge below.
    if (isFirstRun.current) {
      isFirstRun.current = false;
      setLines(loadCart(cartKey(customerId)));
      prevCustomerId.current = customerId;
      return;
    }

    if (customerId === prevCustomerId.current) return;

    if (customerId && !prevCustomerId.current) {
      // Guest -> logged in (a real sign-in during this session): merge
      // whatever was in the guest cart into this customer's saved cart
      // (matches Amazon/Flipkart-style behavior), then clear the guest
      // cart so it doesn't leak into the next guest.
      const guestLines = loadCart(cartKey(null));
      const customerLines = loadCart(cartKey(customerId));
      const merged = mergeLines(customerLines, guestLines);
      localStorage.setItem(cartKey(customerId), JSON.stringify(merged));
      localStorage.removeItem(cartKey(null));
      setLines(merged);
    } else {
      // Logged in -> guest (logout): switch to the guest cart. The previous
      // customer's cart stays untouched in storage for next time they log in.
      setLines(loadCart(cartKey(customerId)));
    }

    prevCustomerId.current = customerId;
  }, [customerId]);

  useEffect(() => {
    localStorage.setItem(cartKey(customerId), JSON.stringify(lines));
  }, [lines, customerId]);

  const addLines = useCallback((newLines) => {
    setLines((prev) => mergeLines(prev, newLines));
    setDrawerOpen(true);
  }, []);

  const updateQuantity = useCallback((key, quantity) => {
    setLines((prev) => prev.map((l) => (lineKey(l) === key ? { ...l, quantity: Math.max(0, quantity) } : l)).filter((l) => l.quantity > 0));
  }, []);

  const removeLine = useCallback((key) => {
    setLines((prev) => prev.filter((l) => lineKey(l) !== key));
  }, []);

  const clearCart = useCallback(() => setLines([]), []);

  const totalItems = lines.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <CartContext.Provider value={{ lines, addLines, updateQuantity, removeLine, clearCart, totalItems, drawerOpen, setDrawerOpen }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
