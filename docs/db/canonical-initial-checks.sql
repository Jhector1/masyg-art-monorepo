-- Review and append these constraints to the generated fresh initial migration.
-- DO NOT apply to the old schema. This file is not auto-executed.
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_priceMinor_nonnegative" CHECK ("priceMinor" >= 0);
ALTER TABLE "InventoryLevel" ADD CONSTRAINT "InventoryLevel_nonnegative" CHECK ("onHand" >= 0 AND "reserved" >= 0 AND "reserved" <= "onHand");
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_amount_valid" CHECK ("quantity" > 0 AND "unitPriceMinor" >= 0 AND "totalMinor" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_amount_valid" CHECK ("subtotalMinor" >= 0 AND "taxMinor" >= 0 AND "shippingMinor" >= 0 AND "totalMinor" >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_nonnegative" CHECK ("amountMinor" >= 0);
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "DigitalGrant" ADD CONSTRAINT "DigitalGrant_uses_valid" CHECK ("uses" >= 0 AND ("maximumUses" IS NULL OR "maximumUses" >= 0));
-- Order and payment totals additionally require transaction-time service checks and reconciliation.
