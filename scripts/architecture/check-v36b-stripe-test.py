#!/usr/bin/env python3
from pathlib import Path
import sys
root=Path(__file__).resolve().parents[2]
checks={
 'packages/server/src/payments/stripe-test-checkout-service.ts':[
   'stripe.tax.calculations.create','getStripeTestPlatformKey','prepareCheckoutAttempt','openStripeTestCheckout','digitalTaxCode',
   'buyerUserId:user.id','CART_NOT_READY'],
 'packages/server/src/api/public/stores/[storeId]/checkout/test/route.ts':[
   'requireSameOriginJson','resolvePublicStoreFromHostHeader','getServerSession','createDigitalStripeTestCheckout'],
 'packages/server/src/payments/stripe-test-webhook-controller.ts':[
   'constructEvent','reconcileSignedStripeTestPayment','reconcileSignedStripeTestExpiration',
   'reconcileSignedStripeTestAsyncFailure','reconcileSignedStripeTestFullRefund'],
 'packages/server/src/api/integrations/stripe/test-webhook/route.ts':[
   'stripe-signature','req.text()','dispatchSignedStripeTestWebhook','status:503'],
 'packages/core/src/lib/stripe-refund-ledger.ts':[
   'Serializable','revokedAt:date','status:"REFUNDED"','providerEvent.create'],
 'packages/ui/src/components/cart/StripeTestCheckoutControl.tsx':[
   'Continue to Stripe test checkout','crypto.randomUUID()','stripe.com'],
}
for rel,needles in checks.items():
 p=root/rel
 if not p.is_file():sys.exit('V36B_MISSING '+rel)
 data=p.read_text()
 for needle in needles:
  if needle not in data:sys.exit('V36B_BOUNDARY_MISSING '+rel+' '+needle)
for app in ['jeanyvesart','ziledigital']:
 p=root/f'apps/{app}/src/app/api/public/stores/[storeId]/checkout/test/route.ts'
 if not p.exists():sys.exit('V36B_MISSING_TEST_ROUTE '+str(p))
p=root/'apps/commerce-api/src/app/v1/webhooks/stripe/route.ts'
if not p.exists():sys.exit('V36B_MISSING_WEBHOOK')
for source in root.glob('apps/*/src/app/**/api/**/route.ts'):
 if 'webhooks/stripe' in str(source) and 'commerce-api' not in str(source):
  sys.exit('V36B_DUPLICATE_WEBHOOK '+str(source))
print('ZILEDIGITAL_V36B_STRIPE_TEST_BOUNDARIES_PASS')
