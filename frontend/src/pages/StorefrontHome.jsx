import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Truck, ShieldCheck, Percent } from 'lucide-react';
import { API } from '../lib/api';
import { ProductCard } from '../components/ProductCard';
import { STOREFRONT } from '../constants/testIds';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04';
const FEATURE_IMAGE = 'https://images.unsplash.com/photo-1540221652346-e5dd6b50f3e7';

export default function StorefrontHome() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    fetch(`${API}/categories`).then((r) => r.json()).then(setCategories).catch(() => {});
    fetch(`${API}/products`).then((r) => r.json()).then(setProducts).catch(() => {});
    fetch(`${API}/settings/public`).then((r) => r.json()).then(setSettings).catch(() => {});
  }, []);

  const tileImageForCategory = (cat) => products.find((p) => p.categoryId === cat.id)?.images?.[0];

  return (
    <div>
      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 pb-16 pt-10 sm:px-8 md:grid-cols-12 md:pt-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative col-span-1 md:col-span-8"
        >
          <div className="relative aspect-[16/11] overflow-hidden rounded-lg sm:aspect-[16/9]">
            <img src={HERO_IMAGE} alt="Wholesale boutique interior" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 text-white">
              <p className="text-xs uppercase tracking-[0.25em] text-white/70">B2B Wholesale · MOQ from 15 units</p>
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
          className="col-span-1 flex flex-col justify-center md:col-span-4"
        >
          <h1 className="font-display text-4xl leading-[1.05] text-[#121826] sm:text-5xl">
            Stock your store, one bulk order at a time.
          </h1>
          <p className="mt-5 text-base text-[#5E6A7D]">
            Tiered wholesale pricing, transparent MOQs, and shipping calculated to your pincode — built for boutiques and resellers.
          </p>
          <Link
            data-testid={STOREFRONT.heroCta}
            to="/catalog"
            className="mt-7 inline-flex items-center gap-2 self-start rounded-full bg-[#0B132B] px-7 py-3.5 text-sm font-medium text-white transition-transform hover:scale-105"
          >
            Explore Catalog <ArrowUpRight size={15} />
          </Link>
        </motion.div>
      </section>

      {categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[#5E6A7D]">Shop by category</p>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {categories.map((cat, i) => (
              <Link
                key={cat.id}
                to={`/catalog?category=${cat.id}`}
                data-testid={STOREFRONT.categoryTile(i)}
                className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-[#F3F1EC]"
              >
                {tileImageForCategory(cat) && (
                  <img src={tileImageForCategory(cat)} alt={cat.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <p className="font-display absolute bottom-3 left-4 text-lg text-white">{cat.name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="flex items-baseline justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-[#5E6A7D]">Featured products</p>
          <Link to="/catalog" className="text-sm text-[#0B132B] underline-offset-4 hover:underline">View all</Link>
        </div>
        <div data-testid={STOREFRONT.productGrid} className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {products.slice(0, 8).map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-5 py-16 sm:px-8 md:grid-cols-2">
        <img src={FEATURE_IMAGE} alt="Wholesale fulfillment" className="aspect-[4/3] w-full rounded-lg object-cover" />
        <div>
          <h2 className="font-display text-3xl text-[#121826] sm:text-4xl">Wholesale, without the guesswork</h2>
          <div className="mt-8 space-y-6">
            <div className="flex gap-4">
              <Percent size={20} className="mt-0.5 shrink-0 text-[#FF4500]" />
              <div>
                <p className="font-medium text-[#121826]">Tier pricing, applied automatically</p>
                <p className="text-sm text-[#5E6A7D]">The more you order, the less you pay per unit — recalculated live as you build your cart.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <Truck size={20} className="mt-0.5 shrink-0 text-[#FF4500]" />
              <div>
                <p className="font-medium text-[#121826]">Shipping by pincode</p>
                <p className="text-sm text-[#5E6A7D]">Rates matched to your delivery zone, with free shipping past a set order value.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <ShieldCheck size={20} className="mt-0.5 shrink-0 text-[#FF4500]" />
              <div>
                <p className="font-medium text-[#121826]">Every order recalculated server-side</p>
                <p className="text-sm text-[#5E6A7D]">Pricing, MOQ, and totals are always verified — no manual errors, no surprises on your invoice.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {settings.whatsappNumber && (
        <section className="px-5 py-14 sm:px-8">
          <a
            data-testid={STOREFRONT.whatsappBanner}
            href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent("Hi, I'd like to place a bulk inquiry.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 rounded-lg bg-[#0B132B] px-8 py-8 text-white sm:flex-row sm:items-center"
          >
            <div>
              <p className="font-display text-2xl">Need a custom bulk quote?</p>
              <p className="mt-1 text-sm text-white/60">Message us on WhatsApp with your requirements — we'll get back within the day.</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#FF4500] px-6 py-3 text-sm font-medium">
              Inquire on WhatsApp <ArrowUpRight size={15} />
            </span>
          </a>
        </section>
      )}
    </div>
  );
}
