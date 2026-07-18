import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { toast } from '../../components/ui/sonner';
import { API } from '../../lib/api';
import { customerAuthHeaders } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/pricing';

export default function Wishlist() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    fetch(`${API}/customers/wishlist`, { headers: customerAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setItems)
      .catch(() => setError('Could not load your wishlist right now. Please refresh or try again shortly.'));
  };

  useEffect(load, []);

  const remove = async (productId) => {
    // Optimistic update — remove immediately, revert if the call fails.
    const prev = items;
    setItems(items.filter((p) => p.id !== productId));
    try {
      await fetch(`${API}/customers/wishlist/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...customerAuthHeaders() },
        body: JSON.stringify({ productId }),
      });
      toast.success('Removed from wishlist');
    } catch {
      setItems(prev);
      toast.error('Could not remove item. Please try again.');
    }
  };

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!items) return <p className="text-sm text-[#5E6A7D]">Loading...</p>;

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl text-[#121826]">Wishlist</h2>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-[#5E6A7D]">
          Nothing saved yet. <Link to="/catalog" className="text-[#0B132B] underline">Browse the catalog</Link> and tap the heart icon on any product to save it here.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {items.map((product) => {
            const minPrice = (product.tierPricing || []).reduce((min, t) => Math.min(min, t.price), product.basePrice || 0);
            return (
              <div key={product.id} className="group relative overflow-hidden border border-black/5 bg-white">
                <button
                  onClick={() => remove(product.id)}
                  title="Remove from wishlist"
                  className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1.5 shadow hover:bg-white"
                >
                  <Heart size={16} className="fill-[#EF4444] text-[#EF4444]" />
                </button>
                <Link to={`/product/${product.id}`} className="block">
                  <div className="aspect-[4/5] overflow-hidden bg-[#F3F1EC]">
                    <img
                      src={product.images?.[0]}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-[#5E6A7D]">MOQ {product.moq} units</p>
                    <h3 className="mt-1 font-display text-base leading-tight text-[#121826]">{product.name}</h3>
                    <p className="mt-1 text-xs text-[#5E6A7D]">From {formatCurrency(minPrice)} / unit</p>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
