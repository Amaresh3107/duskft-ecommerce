import { Link } from 'react-router-dom';
import { formatCurrency } from '../lib/pricing';
import { STOREFRONT } from '../constants/testIds';

export const ProductCard = ({ product, index }) => {
  const minPrice = (product.tierPricing || []).reduce((min, t) => Math.min(min, t.price), product.basePrice || 0);

  return (
    <Link
      to={`/product/${product.id}`}
      data-testid={STOREFRONT.productCard(index)}
      className="group block overflow-hidden border border-black/5 bg-white transition-shadow hover:shadow-[0_12px_32px_rgba(11,19,43,0.1)]"
    >
      <div className="aspect-[4/5] overflow-hidden bg-[#F3F1EC]">
        <img
          src={product.images?.[0]}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
      </div>
      <div className="p-4">
        <p className="text-[10px] uppercase tracking-[0.15em] text-[#5E6A7D]">MOQ {product.moq} units</p>
        <h3 className="mt-1 font-display text-lg leading-tight text-[#121826]">{product.name}</h3>
        <p className="mt-1 text-sm text-[#5E6A7D]">From {formatCurrency(minPrice)} / unit</p>
      </div>
    </Link>
  );
};
