import SaveOrderCta from "./SaveOrderCta";

type SuccessHeaderProps = {
  hasDigital: boolean;
  hasPrint: boolean;
  sessionId?: string | null;
};

export function OrderSuccessHeader({ hasDigital, hasPrint, sessionId }: SuccessHeaderProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      <header className="mb-6 sm:mb-8">
        {/* PRINT-ONLY */}
        {hasPrint && !hasDigital && (
          <>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-indigo-700">
              Your print is in production
            </h1>
            <p className="text-gray-600 mt-2 text-sm sm:text-base">
              We’re preparing your print. We’ll email you tracking as soon as it ships.
              You can view the order details anytime from your account.
            </p>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">
              <span className="font-medium">Kreyòl:</span> Y ap prepare enprime w lan.
              N ap voye yon imel ba ou ak nimewo pou swiv la lè li voye.
              Ou ka gade detay kòmann nan nan kont ou nenpòt ki lè.
            </p>
            {sessionId && (
              <div className="mt-3">
                <SaveOrderCta sessionId={sessionId} />
              </div>
            )}
          </>
        )}

        {/* DIGITAL-ONLY (your original copy, kept) */}
        {!hasPrint && hasDigital && (
          <>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-green-700">
              Your downloads are ready
            </h1>
            <p className="text-gray-600 mt-2 text-sm sm:text-base">
              Save your files below. Guests get time-limited links—create an account to keep access
              forever.
            </p>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">
              <span className="font-medium">Kreyòl:</span> Lyen yo ekspire pou envite. Kreye yon kont
              pou w kenbe yo pou tout tan.
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
              Downloads ready — your print is in production
            </h1>
            <p className="text-gray-600 mt-2 text-sm sm:text-base">
              Save your digital files below. We’re also preparing your print and will email tracking
              as soon as it ships.
            </p>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">
              <span className="font-medium">Kreyòl:</span> Telechaje fichye w yo anba a.
              N ap prepare enprime w lan tou, epi n ap voye nimewo pou swiv la lè li voye.
              Lyen pou envite yo ka ekspire, se poutèt sa li pi bon pou kreye yon kont.
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
