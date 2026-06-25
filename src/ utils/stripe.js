let stripe = null;
function getStripe() {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

// Create a checkout session for membership dues or donations
async function createCheckoutSession({ amount, currency = 'usd', description, successUrl, cancelUrl, metadata = {} }) {
  const s = getStripe();
  if (!s) throw new Error('Stripe is not configured.');
  return s.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price_data: { currency, product_data: { name: description }, unit_amount: Math.round(amount * 100) }, quantity: 1 }],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
  });
}

// Create a Stripe Connect Express account for a member (for payouts)
async function createMemberConnectAccount({ email, name }) {
  const s = getStripe();
  if (!s) throw new Error('Stripe is not configured.');
  const account = await s.accounts.create({
    type: 'express',
    email,
    capabilities: { transfers: { requested: true } },
    business_profile: { name },
  });
  return account;
}

// Generate an onboarding link for a member's Connect account
async function createConnectOnboardingLink(accountId, returnUrl) {
  const s = getStripe();
  if (!s) throw new Error('Stripe is not configured.');
  return s.accountLinks.create({ account: accountId, refresh_url: returnUrl, return_url: returnUrl, type: 'account_onboarding' });
}

// Pay out to a member's Connect account
async function transferToMember({ amount, currency = 'usd', destinationAccountId, description }) {
  const s = getStripe();
  if (!s) throw new Error('Stripe is not configured.');
  return s.transfers.create({
    amount: Math.round(amount * 100),
    currency,
    destination: destinationAccountId,
    description,
  });
}

// Verify a webhook event signature
function constructWebhookEvent(rawBody, signature) {
  const s = getStripe();
  if (!s) throw new Error('Stripe not configured.');
  return s.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}

function isConfigured() {
  return !!process.env.STRIPE_SECRET_KEY;
}

module.exports = { createCheckoutSession, createMemberConnectAccount, createConnectOnboardingLink, transferToMember, constructWebhookEvent, isConfigured };
