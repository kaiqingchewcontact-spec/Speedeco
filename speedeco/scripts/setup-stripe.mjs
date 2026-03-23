// Run: STRIPE_SECRET_KEY=sk_live_... node scripts/setup-stripe.mjs

import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function setup() {
  console.log('Creating Speedeco product...');
  const product = await stripe.products.create({
    name: 'Speedeco',
    description: 'Turn any text into a presentation worth sharing',
  });
  console.log('Product ID:', product.id);

  console.log('Creating Pro price ($15/mo)...');
  const proPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 1500,
    currency: 'usd',
    recurring: { interval: 'month' },
    lookup_key: 'speedeco_pro_monthly',
  });
  console.log('Pro Price ID:', proPrice.id);

  console.log('\n✅ Done! Add to Vercel env vars:\n');
  console.log(`STRIPE_PRO_PRICE_ID=${proPrice.id}`);
}

setup().catch(console.error);
