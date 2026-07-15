/**
 * Api_Products.gs
 * ------------------------------------------------------------------
 * Product schema recap (see Setup.gs):
 *   tierPricingJson -> array of { minQty: number, price: number }
 *     e.g. [{minQty:1,price:500}, {minQty:50,price:450}, {minQty:200,price:400}]
 *   colorsJson  -> array of strings, e.g. ["Black","White","Navy"]
 *   sizesJson   -> array of strings, e.g. ["S","M","L","XL"]
 *   imagesJson  -> array of image URLs (Drive file URLs or external)
 * ------------------------------------------------------------------
 */

const Products = {

  list: function (filters) {
    filters = filters || {};
    let items = DB.query('Products', function (p) { return p.status === 'active' || filters.includeInactive; });

    if (filters.categoryId) {
      items = items.filter(function (p) { return p.categoryId === filters.categoryId; });
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(function (p) {
        return (p.name || '').toLowerCase().indexOf(q) !== -1 ||
               (p.sku || '').toLowerCase().indexOf(q) !== -1;
      });
    }
    return items;
  },

  get: function (id) {
    const product = DB.getById('Products', id);
    if (!product) throw new Error('Product not found.');
    return product;
  },

  create: function (payload, token) {
    requireRole_(token, ['admin', 'staff']);
    return DB.insert('Products', normalizeProductPayload_(payload));
  },

  update: function (id, payload, token) {
    requireRole_(token, ['admin', 'staff']);
    const updated = DB.update('Products', id, normalizeProductPayload_(payload));
    if (!updated) throw new Error('Product not found.');
    return updated;
  },

  remove: function (id, token) {
    requireRole_(token, ['admin']);
    return DB.remove('Products', id);
  },

  /**
   * Given a total quantity across all colors/sizes for one product,
   * returns the applicable unit price based on tierPricingJson, and
   * flags whether the MOQ has been met.
   */
  calculatePrice: function (productId, quantity) {
    const product = this.get(productId);
    const tiers = (product.tierPricingJson || []).slice().sort(function (a, b) { return a.minQty - b.minQty; });

    let unitPrice = product.basePrice;
    tiers.forEach(function (tier) {
      if (quantity >= tier.minQty) unitPrice = tier.price;
    });

    const moq = Number(product.moq) || 1;
    return {
      productId: productId,
      quantity: quantity,
      unitPrice: unitPrice,
      lineTotal: unitPrice * quantity,
      moq: moq,
      moqMet: quantity >= moq
    };
  }
};

function normalizeProductPayload_(payload) {
  return {
    sku: payload.sku,
    name: payload.name,
    slug: payload.slug || slugify_(payload.name || ''),
    categoryId: payload.categoryId,
    description: payload.description || '',
    imagesJson: payload.images || [],
    videoUrl: payload.videoUrl || '',
    colorsJson: payload.colors || [],
    sizesJson: payload.sizes || [],
    tierPricingJson: payload.tierPricing || [],
    basePrice: Number(payload.basePrice) || 0,
    moq: Number(payload.moq) || 1,
    stock: Number(payload.stock) || 0,
    status: payload.status || 'active'
  };
}

function slugify_(text) {
  return String(text).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
