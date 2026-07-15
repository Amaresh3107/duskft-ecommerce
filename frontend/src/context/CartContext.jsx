import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CartContext = createContext(null);
const STORAGE_KEY = 'cart_items';

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function lineKey(l) {
  return `${l.productId}__${l.color}__${l.size}`;
}

export function CartProvider({ children }) {
  const [lines, setLines] = useState(loadCart);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

  const addLines = useCallback((newLines) => {
    setLines((prev) => {
      const next = [...prev];
      newLines.forEach((nl) => {
        const idx = next.findIndex((l) => lineKey(l) === lineKey(nl));
        if (idx >= 0) next[idx] = { ...next[idx], quantity: next[idx].quantity + nl.quantity };
        else next.push(nl);
      });
      return next;
    });
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
