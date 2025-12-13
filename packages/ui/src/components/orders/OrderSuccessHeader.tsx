"use client";

import SaveOrderCta from "./SaveOrderCta";

type ProductKind = "STICKER" | "MUG" | "CARD" | "BOOK_DIGITAL" | "ART" | "OTHER";

type SuccessHeaderProps = {
  hasDigital: boolean;
  hasPrint: boolean;
  sessionId?: string | null;
  kind?: ProductKind;
};

function printTitle(kind?: ProductKind) {
  switch (kind) {
    case "MUG":
      return "Your mug is in production";
    case "CARD":
      return "Your cards are in production";
    case "STICKER":
      return "Your stickers are in production";
    case "ART":
      return "Your art print is in production";
    case "BOOK_DIGITAL":
      return "Your book is being prepared";
    default:
      return "Your print is in production";
  }
}

function digitalTitle(kind?: ProductKind) {
  switch (kind) {
    case "BOOK_DIGITAL":
      return "Your e-book is ready";
    case "STICKER":
      return "Your sticker files are ready";
    case "CARD":
      return "Your card files are ready";
    case "MUG":
      return "Your mug design is ready";
    case "ART":
      return "Your artwork downloads are ready";
    default:
      return "Your downloads are ready";
  }
}

function mixedTitle(kind?: ProductKind) {
  switch (kind) {
    case "MUG":
      return "Design downloads ready — your mug is in production";
    case "CARD":
      return "Downloads ready — your cards are in production";
    case "STICKER":
      return "Downloads ready — your stickers are in production";
    case "BOOK_DIGITAL":
      return "E-book ready — your print is in production";
    case "ART":
      return "Downloads ready — your art print is in production";
    default:
      return "Downloads ready — your print is in production";
  }
}

export function OrderSuccessHeader({
  hasDigital,
  hasPrint,
  sessionId,
  kind,
}: SuccessHeaderProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      <header className="mb-6 sm:mb-8">
        {/* PRINT-ONLY */}
        {hasPrint && !hasDigital && (
          <>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-indigo-700">
              {printTitle(kind)}
            </h1>
            <p className="text-gray-600 mt-2 text-sm sm:text-base">
              We’re preparing your item. We’ll email you tracking as soon as it
              ships. You can view the order details anytime from your account.
            </p>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">
              <span className="font-medium">Kreyòl:</span> Y ap prepare kòmann
              ou a. N ap voye yon imel ba ou ak nimewo pou swiv la lè li voye.
              Ou ka gade detay kòmann nan nan kont ou nenpòt ki lè.
            </p>
            {sessionId && (
              <div className="mt-3">
                <SaveOrderCta sessionId={sessionId} />
              </div>
            )}
          </>
        )}

        {/* DIGITAL-ONLY */}
        {!hasPrint && hasDigital && (
          <>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-green-700">
              {digitalTitle(kind)}
            </h1>
            <p className="text-gray-600 mt-2 text-sm sm:text-base">
              Save your files below. Guests get time-limited links—create an
              account to keep access forever.
            </p>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">
              <span className="font-medium">Kreyòl:</span> Lyen yo ekspire pou
              envite. Kreye yon kont pou w kenbe yo pou tout tan.
            </p>
            {sessionId && (
              <div className="mt-3">
                <SaveOrderCta sessionId={sessionId} />
              </div>
            )}
          </>
        )}

        {/* MIXED ORDER (digital + print) */}
        {hasPrint && hasDigital && (
          <>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-teal-700">
              {mixedTitle(kind)}
            </h1>
            <p className="text-gray-600 mt-2 text-sm sm:text-base">
              Save your digital files below. We’re also preparing your physical
              item and will email tracking as soon as it ships.
            </p>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">
              <span className="font-medium">Kreyòl:</span> Telechaje fichye w yo
              anba a. N ap prepare atik fizik ou a tou, epi n ap voye nimewo pou
              swiv la lè li voye. Lyen pou envite yo ka ekspire, se poutèt sa li
              pi bon pou kreye yon kont.
            </p>
            {sessionId && (
              <div className="mt-3">
                <SaveOrderCta sessionId={sessionId} />
              </div>
            )}
          </>
        )}
      </header>
    </div>
  );
}
