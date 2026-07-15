export function calcTierUnitPrice(line, totalQty) {
  const tiers = [...(line.tierPricing || [])].sort((a, b) => a.minQty - b.minQty);
  let price = line.basePrice || 0;
  for (const t of tiers) {
    if (totalQty >= t.minQty) price = t.price;
  }
  return price;
}

export function cartTotals(lines) {
  const qtyByProduct = {};
  lines.forEach((l) => {
    qtyByProduct[l.productId] = (qtyByProduct[l.productId] || 0) + l.quantity;
  });
  let subtotal = 0;
  const priced = lines.map((l) => {
    const unitPrice = calcTierUnitPrice(l, qtyByProduct[l.productId]);
    const lineTotal = unitPrice * l.quantity;
    subtotal += lineTotal;
    return { ...l, unitPrice, lineTotal };
  });
  return { priced, subtotal, qtyByProduct };
}

export function moqStatusByProduct(lines) {
  const { qtyByProduct } = cartTotals(lines);
  const status = {};
  lines.forEach((l) => {
    status[l.productId] = { qty: qtyByProduct[l.productId], moq: l.moq, met: qtyByProduct[l.productId] >= l.moq, name: l.name };
  });
  return status;
}

export function formatCurrency(amount, symbol = '\u20b9') {
  const n = Number(amount || 0);
  return `${symbol}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
