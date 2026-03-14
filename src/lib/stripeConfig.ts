// Stripe publishable keys (public — safe to store in codebase)
export const STRIPE_PUBLISHABLE_KEY =
  "pk_live_51T5enNRqpdAZA3POznPld3guRt6XkRLYvloPVJ2gJmLstJ85RfyAvBfYBYbXxcKnK3lhFji39JAPrNSPieU1MesW00UYD0J59H";

// TODO: substituir pelo pk_test_ real do Stripe Dashboard (conta acct_1T5enXRx7ISXg9Fb → Developers → API Keys)
export const STRIPE_TEST_PUBLISHABLE_KEY = "pk_test_PLACEHOLDER";

// Stripe Pricing Table IDs
export const STRIPE_PRICING_TABLE_ID = "prctbl_1TAXmVRqpdAZA3POd8N59gvn";

// TODO: criar pricing table de teste no Stripe Dashboard (conta TEST) com Retention + Growth test products
export const STRIPE_TEST_PRICING_TABLE_ID = "prctbl_test_PLACEHOLDER";
