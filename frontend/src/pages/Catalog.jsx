import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { API } from '../lib/api';
import { ProductCard } from '../components/ProductCard';
import { Input } from '../components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';
import { CATALOG } from '../constants/testIds';

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const categoryId = params.get('category') || 'all';

  useEffect(() => {
    fetch(`${API}/categories`).then((r) => r.json()).then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const query = new URLSearchParams();
    if (categoryId !== 'all') query.set('categoryId', categoryId);
    if (search) query.set('search', search);
    fetch(`${API}/products?${query.toString()}`)
      .then((r) => r.json())
      .then(setProducts)
      .finally(() => setLoading(false));
  }, [categoryId, search]);

  const heading = useMemo(() => {
    if (categoryId === 'all') return 'All Products';
    return categories.find((c) => c.id === categoryId)?.name || 'Products';
  }, [categoryId, categories]);

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <p className="text-xs uppercase tracking-[0.2em] text-[#5E6A7D]">Catalog</p>
      <h1 className="font-display mt-1 text-4xl text-[#121826]">{heading}</h1>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5E6A7D]" />
          <Input
            data-testid={CATALOG.searchInput}
            placeholder="Search products or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-full border-black/10 bg-white pl-9"
          />
        </div>
        <Select value={categoryId} onValueChange={(v) => setParams(v === 'all' ? {} : { category: v })}>
          <SelectTrigger data-testid={CATALOG.categorySelect} className="w-full rounded-full border-black/10 bg-white sm:w-56">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[4/5] animate-pulse bg-[#F3F1EC]" />)}
        </div>
      ) : products.length === 0 ? (
        <p data-testid={CATALOG.emptyState} className="mt-16 text-center text-sm text-[#5E6A7D]">No products match your search.</p>
      ) : (
        <div data-testid={CATALOG.productGrid} className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
      )}
    </div>
  );
}
