"use client";
import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";

/**
 * EditorPromo – a polished, responsive hero/section to showcase your Artwork Customizer.
 *
 * Now more flexible with configurable features, actions, and expandable details.
 *
 * From our codebase capabilities:
 * - Edit style on eligible SVG-based artworks (background fill, stroke color/width, opacity)
 * - Live preview while editing
 * - Size controls and DPI awareness for exports
 * - Export flows: preview (watermarked), JPG raster export; PNG/SVG/PDF when eligible
 * - Entitlements/credits for high‑res exports; resume last save when logged in
 * - Unsaved changes protection
 */

export type EditorAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "link";
  ariaLabel?: string;
};

export type EditorPromoProps = {
  title?: string;
  subtitle?: string;
  videoSrc?: string;
  posterSrc?: string;
  /** Primary CTA target (used if no custom actions are provided) */
  ctaHref?: string;
  ctaLabel?: string;
  className?: string;
  /** Optional small-print line under the CTAs */
  note?: string;
  /** Optional custom features (tags). If omitted, sensible defaults are shown. */
  features?: string[];
  /** Optional custom actions; overrides default primary/ghost buttons. */
  actions?: EditorAction[];
  /** Optional element below the video for a caption or credit line */
  children?: React.ReactNode;
};

export default function EditorPromo({
  title = "Customize your artwork in seconds",
  subtitle =
    "Swap backgrounds, fine‑tune strokes, adjust sizes/DPI, and export a crisp JPG when you're ready.",
  videoSrc =
    "https://res.cloudinary.com/dqeqbgxvn/video/upload/v1755645824/YouCut_20250819_181240433_xksigu.mp4",
  posterSrc = "/images/editor-poster.png",
  ctaHref = "https://ziledigital.com/store/a0f28028-86a8-40df-ad53-ced5014a1ff7/studio",
  ctaLabel = "Try the Customizer",
  className = "",
  note =
    "High‑res exports unlock after purchase or with export credits on eligible items.",
  features,
  actions,
  children,
}: EditorPromoProps) {
  const featureTags =
    features ?? [
      "🎨 Change background (solid/gradient)",
      "✏️ Adjust stroke (color & width)",
      "🖼️ Live preview",
      "📐 Choose size & DPI",
      "📤 Export JPG, PNG, WEBP",
    ];

  const defaultActions: EditorAction[] = [
    { label: ctaLabel, href: ctaHref, variant: "primary", ariaLabel: ctaLabel },
    { label: "How it works", href: "/how-it-works", variant: "ghost" },
    { label: "See sample artworks", href: "/store", variant: "link" },
  ];

  const renderedActions = actions && actions.length > 0 ? actions : defaultActions;

  return (
    <section
      className={
        "relative isolate overflow-hidden " +
        "mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 " +
        (className ?? "")
      }
      aria-label="Artwork Customizer preview"
    >
      {/* subtle glow background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl opacity-20 bg-gradient-to-tr from-emerald-400 via-sky-400 to-indigo-400" />
        <div className="absolute -bottom-16 -right-16 h-72 w-72 rounded-full blur-3xl opacity-20 bg-gradient-to-tr from-fuchsia-400 via-rose-400 to-amber-400" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="grid gap-8 lg:grid-cols-2 items-center"
      >
        {/* Copy / CTA */}
        <div className="order-2 lg:order-1">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-gray-900">
            {title}
          </h2>
          <p className="mt-3 text-base sm:text-lg text-gray-600 max-w-prose">
            {subtitle}
          </p>

          {/* Feature pills */}
          <ul className="mt-5 flex flex-wrap gap-2">
            {featureTags.map((text, i) => (
              <FeaturePill key={i}>{text}</FeaturePill>
            ))}
          </ul>

          {/* Actions */}
          <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
            <ActionsBar actions={renderedActions} />
          </div>

          <p className="mt-3 text-xs text-gray-500">{note}</p>

          {/* Expandable details for power users */}
          <div className="mt-6 space-y-3">
            <Details title="What can I edit?">
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                <li><strong>Background:</strong> switch solid colors or tasteful gradients.</li>
                <li><strong>Stroke:</strong> tweak color, width, and opacity for clean line work.</li>
                <li><strong>Size & Units:</strong> pick common print sizes; DPI-aware raster export.</li>
                <li><strong>Live preview:</strong> see changes instantly before you export.</li>
              </ul>
            </Details>

            <Details title="Exports & licensing">
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                <li><strong>Preview:</strong> quick, watermarked previews for sharing WIP.</li>
                <li><strong>JPG:</strong> high‑quality raster export; perfect for social and prints.</li>
                <li><strong>PNG/SVG/PDF:</strong> available on eligible designs. Vector exports keep lines crisp at any scale.</li>
                <li><strong>Credits/Entitlements:</strong> high‑res and vector exports use your export credits or a recent purchase.</li>
                <li><strong>Resume work:</strong> when logged in, you can come back to your last saved design.</li>
              </ul>
            </Details>

            <Details title="Good to know">
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                <li>Look for the <em>Customizable</em> badge on product pages.</li>
                <li>Unsaved changes warning helps prevent accidental loss while editing.</li>
                <li>Some features vary by artwork depending on licensing and format.</li>
              </ul>
            </Details>
          </div>
        </div>

    {/* Video demo */}
<div className="order-1 lg:order-2">
  <figure className="relative rounded-2xl border border-black/10 bg-white shadow-xl shadow-black/5 overflow-hidden">
    <div className="relative aspect-video">
      <ClientOnlyVideo
        src={videoSrc}
        poster={posterSrc}
        className="h-full w-full object-cover"
        ariaLabel="Customizer demo: changing background and stroke, then exporting a JPG"
      />
    </div>
    {children ? (
      <figcaption className="px-4 py-3 text-xs text-gray-500 border-t border-black/10">
        {children}
      </figcaption>
    ) : null}
  </figure>
</div>

      </motion.div>
    </section>
  );
}

/* ————————————————————————————————————————————————
   Lightweight UI atoms (no external UI deps)
———————————————————————————————————————————————— */
function FeaturePill({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-full ring-1 ring-black/10 bg-white px-3 py-1 text-sm">
      {children}
    </li>
  );
}

function ActionsBar({ actions }: { actions: EditorAction[] }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      {actions.map((a, i) => {
        if (a.onClick && !a.href) {
          const Btn = a.variant === "ghost" ? GhostButton : a.variant === "link" ? LinkButton : PrimaryButton;
          return (
            <Btn key={i} onClick={a.onClick} ariaLabel={a.ariaLabel}>
              {a.label}
            </Btn>
          );
        }
        // default Link behavior
        const Comp = a.variant === "ghost" ? GhostLink : a.variant === "link" ? LinkText : PrimaryLink;
        return (
          <Comp key={i} href={a.href ?? "#"} ariaLabel={a.ariaLabel}>
            {a.label}
          </Comp>
        );
      })}
    </div>
  );
}

function PrimaryLink({ href, children, ariaLabel }: { href: string; children: React.ReactNode; ariaLabel?: string }) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 active:bg-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/30 shadow-sm"
    >
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}

function GhostLink({ href, children, ariaLabel }: { href: string; children: React.ReactNode; ariaLabel?: string }) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 active:bg-gray-100 ring-1 ring-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20"
    >
      {children}
    </Link>
  );
}

function LinkText({ href, children, ariaLabel }: { href: string; children: React.ReactNode; ariaLabel?: string }) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="text-sm font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900"
    >
      {children}
    </Link>
  );
}

function PrimaryButton({ onClick, children, ariaLabel }: { onClick: () => void; children: React.ReactNode; ariaLabel?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 active:bg-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/30 shadow-sm"
    >
      {children}
      <span aria-hidden>→</span>
    </button>
  );
}

function GhostButton({ onClick, children, ariaLabel }: { onClick: () => void; children: React.ReactNode; ariaLabel?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 active:bg-gray-100 ring-1 ring-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20"
    >
      {children}
    </button>
  );
}

function LinkButton({ onClick, children, ariaLabel }: { onClick: () => void; children: React.ReactNode; ariaLabel?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="text-sm font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900"
    >
      {children}
    </button>
  );
}

function Details({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-black/10 bg-white/60 backdrop-blur-sm px-4 py-3 open:bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-gray-800">
        <span>{title}</span>
        <span className="transition-transform group-open:rotate-180" aria-hidden>▾</span>
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}


function ClientOnlyVideo({
  src,
  poster,
  className,
  ariaLabel,
}: {
  src: string;
  poster: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [mounted, setMounted] = React.useState(false);
  const ref = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    // Nudge autoplay on iOS once mounted
    if (mounted && ref.current && ref.current.paused) {
      ref.current.play().catch(() => {});
    }
  }, [mounted]);

  // SSR + first client render: identical <img>, avoiding hydration mismatch
  if (!mounted) {
    return (
      <img
        src={poster}
        alt="Customizer demo preview"
        className={className}
        loading="eager"
        decoding="async"
      />
    );
  }

  // After hydration, swap to the actual <video>
  return (
    <video
      ref={ref}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster={poster}
      className={className}
      aria-label={ariaLabel}
      // Optional UX hardening:
      // controls={false}
      // disablePictureInPicture
      // controlsList="nodownload noplaybackrate noremoteplayback"
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
