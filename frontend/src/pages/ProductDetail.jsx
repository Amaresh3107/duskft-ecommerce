import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Heart, MessageCircle } from 'lucide-react';
import { toast } from '../components/ui/sonner';
import { Button } from '../components/ui/button';
import { API, resolveImageUrl } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { customerAuthHeaders } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { calcTierUnitPrice, formatCurrency } from '../lib/pricing';
import { PDP } from '../constants/testIds';

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [settings, setSettings] = useState({});
  const [activeImage, setActiveImage] = useState(0);
  const [matrix, setMatrix] = useState({});
  const [wishlisted, setWishlisted] = useState(false);
  const { isAuthenticated } = useAuth();
  const { addLines } = useCart();

  useEffect(() => {
    fetch(`${API}/products/${id}`).then((r) => r.json()).then(setProduct);
    fetch(`${API}/settings/public`).then((r) => r.json()).then(setSettings).catch(() => {});
  }, [id]);

  const colors = product?.colors?.length ? product.colors : ['Standard'];
  const sizes = product?.sizes?.length ? product.sizes : ['Standard'];

  const totalQty = useMemo(() => Object.values(matrix).reduce((sum, q) => sum + (q || 0), 0), [matrix]);
  const unitPrice = product ? calcTierUnitPrice(product, totalQty) : 0;
  const moqMet = product ? totalQty >= product.moq : false;

  if (!product) {
    return <div className="mx-auto max-w-7xl px-5 py-24 text-center text-sm text-[#5E6A7D]">Loading product...</div>;
  }

  const setCell = (color, size, value) => {
    const qty = Math.max(0, parseInt(value || '0', 10));
    setMatrix((m) => ({ ...m, [`${color}__${size}`]: qty }));
  };

  const handleAddToCart = () => {
    if (product.stock <= 0) {
      toast.error(`"${product.name}" is currently out of stock.`);
      return;
    }
    if (!moqMet) {
      toast.error(`Minimum order for this product is ${product.moq} units — you have ${totalQty}.`);
      return;
    }
    if (totalQty > product.stock) {
      toast.error(`Only ${product.stock} units of "${product.name}" are available right now.`);
      return;
    }
    const newLines = Object.entries(matrix)
      .filter(([, qty]) => qty > 0)
      .map(([key, qty]) => {
        const [color, size] = key.split('__');
        return {
          productId: product.id, name: product.name, image: product.images?.[0], sku: product.sku,
          color, size, quantity: qty, moq: product.moq, tierPricing: product.tierPricing, basePrice: product.basePrice,
        };
      });
    addLines(newLines);
    setMatrix({});
    toast.success('Added to cart');
  };

  const toggleWishlist = async () => {
    if (!isAuthenticated) {
      toast.error('Please log in to save items to your wishlist.');
      return;
    }
    const res = await fetch(`${API}/customers/wishlist/toggle`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...customerAuthHeaders() },
      body: JSON.stringify({ productId: product.id }),
    });
    const data = await res.json();
    setWishlisted(data.added);
    toast.success(data.added ? 'Added to wishlist' : 'Removed from wishlist');
  };

  const youtubeId = product.videoUrl?.match(/(?:v=|youtu\.be\/)([\w-]{11})/)?.[1];

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <div>
          <div data-testid={PDP.gallery} className="aspect-square overflow-hidden rounded-lg bg-[#F3F1EC]">
            <img src={resolveImageUrl(product.images?.[activeImage])} alt={product.name} className="h-full w-full object-cover" />
          </div>
          {product.images?.length > 1 && (
            <div className="mt-3 flex gap-2">
              {product.images.map((img, i) => (
                <button key={i} data-testid={PDP.thumbnail(i)} onClick={() => setActiveImage(i)}
                        className={`h-16 w-16 overflow-hidden rounded-md border-2 ${i === activeImage ? 'border-[#FF4500]' : 'border-transparent'}`}>
                  <img src={resolveImageUrl(img)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {youtubeId && (
            <div data-testid={PDP.video} className="mt-4 aspect-video overflow-hidden rounded-lg">
              <iframe className="h-full w-full" src={`https://www.youtube.com/embed/${youtubeId}`} title="Product video" allowFullScreen />
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#5E6A7D]">SKU {product.sku}</p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <h1 className="font-display text-3xl text-[#121826] sm:text-4xl">{product.name}</h1>
            <button data-testid={PDP.wishlistButton} onClick={toggleWishlist} className="shrink-0 rounded-full border border-black/10 p-2.5 hover:border-[#EF4444]">
              <Heart size={18} className={wishlisted ? 'fill-[#EF4444] text-[#EF4444]' : 'text-[#121826]'} />
            </button>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[#5E6A7D]">{product.description}</p>

          <div data-testid={PDP.moqNotice} className="mt-5 inline-flex items-center rounded-full bg-[#F59E0B]/10 px-3 py-1.5 text-xs font-medium text-[#7a5205]">
            Minimum order quantity: {product.moq} units (across all colors/sizes)
          </div>

          <table data-testid={PDP.tierPricingTable} className="mt-5 w-full border border-black/10 text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-[#F3F1EC] text-left uppercase tracking-wide text-[10px] text-[#5E6A7D]">
                <th className="px-3 py-2">Quantity</th>
                <th className="px-3 py-2">Unit Price</th>
              </tr>
            </thead>
            <tbody>
              {[...(product.tierPricing || [])].sort((a, b) => a.minQty - b.minQty).map((t, i) => (
                <tr key={i} className={`border-b border-black/5 ${totalQty >= t.minQty ? 'bg-[#FF4500]/5 font-medium' : ''}`}>
                  <td className="px-3 py-2">{t.minQty}+ units</td>
                  <td className="px-3 py-2">{formatCurrency(t.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6">
            <p className="mb-2 text-xs uppercase tracking-[0.15em] text-[#5E6A7D]">Build your order</p>
            <div data-testid={PDP.matrix} className="overflow-x-auto rounded-lg border border-black/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F3F1EC]">
                    <th className="sticky left-0 bg-[#F3F1EC] px-3 py-2 text-left text-xs uppercase text-[#5E6A7D]">Color \ Size</th>
                    {sizes.map((s) => <th key={s} className="px-3 py-2 text-center text-xs text-[#5E6A7D]">{s}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {colors.map((color) => (
                    <tr key={color} className="border-t border-black/5">
                      <td className="sticky left-0 bg-white px-3 py-2 font-medium text-[#121826]">{color}</td>
                      {sizes.map((size) => (
                        <td key={size} className="px-2 py-2 text-center">
                          <input
                            data-testid={PDP.matrixInput(color, size)}
                            type="number"
                            min="0"
                            value={matrix[`${color}__${size}`] || ''}
                            onChange={(e) => setCell(color, size, e.target.value)}
                            placeholder="0"
                            className="w-14 rounded-md border border-black/10 px-2 py-1 text-center outline-none focus:border-[#0B132B]"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div data-testid={PDP.runningTotal} className="mt-4 flex items-center justify-between rounded-lg bg-[#F3F1EC] px-4 py-3">
              <div>
                <p className="text-xs text-[#5E6A7D]">{totalQty} units selected · {formatCurrency(unitPrice)}/unit</p>
                {!moqMet && totalQty > 0 && <p className="text-xs text-[#EF4444]">Below MOQ of {product.moq} units</p>}
              </div>
              <p className="font-display text-xl text-[#121826]">{formatCurrency(unitPrice * totalQty)}</p>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button data-testid={PDP.addToCartButton} onClick={handleAddToCart} disabled={totalQty === 0 || product.stock <= 0}
                      className="flex-1 rounded-full bg-[#FF4500] py-6 text-base font-medium text-white hover:bg-[#FF4500]/90 disabled:bg-gray-300">
                {product.stock <= 0 ? 'Out of Stock' : 'Add to Cart'}
              </Button>
              {settings.whatsappNumber && (
                <a
                  data-testid={PDP.whatsappInquireButton}
                  href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(`Hi, I'm interested in bulk pricing for ${product.name} (SKU ${product.sku}).`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-[#0B132B] px-6 py-3 text-sm font-medium text-[#0B132B] hover:bg-[#0B132B] hover:text-white"
                >
                  <MessageCircle size={16} /> Inquire in Bulk
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <Link to="/catalog" className="mt-10 inline-block text-sm text-[#5E6A7D] underline-offset-4 hover:underline">← Back to catalog</Link>
    </div>
  );
}
