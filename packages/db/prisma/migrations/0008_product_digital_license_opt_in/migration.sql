-- Product-scoped opt-in to licensed digital editions; existing products remain unlicensed.
ALTER TABLE "ziledigital"."Product" ADD COLUMN "offersDigitalLicenses" BOOLEAN NOT NULL DEFAULT false;
