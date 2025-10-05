"use client";

import { useState, useEffect, useMemo, Dispatch, SetStateAction } from "react";
import { motion } from "framer-motion";
import categories from "@acme/core/data/categories";
import { formatSizeLive, normalizeSizeOnBlur, SIZE_PATTERN, SIZE_RE } from "@acme/core/utils/helpers";

// ---------- helpers ----------
const sameFile = (a: File, b: File) =>
  a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

function appendFiles(files: FileList | null, setter: Dispatch<SetStateAction<File[]>>) {
  if (!files) return;
  const incoming = Array.from(files);
  setter((prev) => {
    const next = [...prev];
    for (const f of incoming) if (!prev.some((p) => sameFile(p, f))) next.push(f);
    return next;
  });
}

export default function ProductForm() {
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");

  // NEW: product type (DIGITAL | PRINT | ORIGINAL)
  const [variantType, setVariantType] = useState<"DIGITAL" | "PRINT" | "ORIGINAL">("DIGITAL");

  // Physical painting fields (used only when ORIGINAL)
  const [widthIn, setWidthIn] = useState<string>("");
  const [heightIn, setHeightIn] = useState<string>("");
  const [depthIn, setDepthIn] = useState<string>("");
  const [weightLb, setWeightLb] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [medium, setMedium] = useState<string>("");
  const [surface, setSurface] = useState<string>("");
  const [framed, setFramed] = useState<boolean>(false);
  const [sku, setSku] = useState<string>("");

  const [main, setMain] = useState<File | null>(null);
  const [thumbnails, setThumbnails] = useState<File[]>([]);
  const [formats, setFormats] = useState<File[]>([]);
  const [svgFile, setSvgFile] = useState<File | null>(null);

  const [mainPreview, setMainPreview] = useState<string | null>(null);
  const [thumbPreviews, setThumbPreviews] = useState<string[]>([]);
  const [formatPreviews, setFormatPreviews] = useState<{ url: string; type: string }[]>([]);
  const [svgPreviewUrl, setSvgPreviewUrl] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);

  // sizes (used by digital/print)
  const [sizes, setSizes] = useState<string[]>([]);
  const CATEGORY_OPTIONS = useMemo(() => categories, []);

  const addSizeField = () => setSizes((s) => [...s, ""]);
  const updateSize = (idx: number, val: string) => {
    setSizes((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };
  const removeSizeField = (idx: number) => setSizes((prev) => prev.filter((_, i) => i !== idx));

  // remove handlers
  const removeThumbnail = (idx: number) => setThumbnails((prev) => prev.filter((_, i) => i !== idx));
  const removeFormat = (idx: number) => setFormats((prev) => prev.filter((_, i) => i !== idx));

  // ---------- previews ----------
  useEffect(() => {
    if (!main) { setMainPreview(null); return; }
    const url = URL.createObjectURL(main);
    setMainPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [main]);

  useEffect(() => {
    const urls = thumbnails.map((f) => URL.createObjectURL(f));
    setThumbPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [thumbnails]);

  useEffect(() => {
    const previews = formats.map((f) => ({ url: URL.createObjectURL(f), type: f.type }));
    setFormatPreviews(previews);
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [formats]);

  useEffect(() => {
    if (!svgFile) { setSvgPreviewUrl(null); return; }
    const url = URL.createObjectURL(svgFile);
    setSvgPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [svgFile]);

  // ---------- submit ----------
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!main) {
      alert("Please select a main image");
      return;
    }

    // Validate size rows only if NOT an original painting
    if (variantType !== "ORIGINAL") {
      const firstBad = sizes.findIndex((s) => s.trim() !== "" && !SIZE_RE.test(s.trim()));
      if (firstBad !== -1) {
        const badVal = sizes[firstBad];
        alert(`Invalid size at row ${firstBad + 1}: "${badVal}".\nUse a format like 10" x 12".`);
        return;
      }
    } else {
      // Minimal sanity for paintings
      if (!widthIn || !heightIn) {
        alert("Please provide width and height (inches) for the painting.");
        return;
      }
    }

    setUploading(true);

    const data = new FormData();
    data.append("category", category);
    data.append("title", title);
    data.append("description", description);
    data.append("price", price);
    data.append("variantType", variantType);
    data.append("main", main);

    // Digital/Print only
    if (variantType !== "ORIGINAL") {
      sizes.forEach((sz) => data.append("sizes", sz));
      thumbnails.forEach((f) => data.append("thumbnails", f));
      formats.forEach((f) => data.append("formats", f));
      if (svgFile) data.append("svg", svgFile);
    } else {
      // Originals: keep images (main + thumbs) for gallery; skip deliverables
      thumbnails.forEach((f) => data.append("thumbnails", f));
      // Optional: allow certificate PDF uploads as attachments if you still want
      // formats.forEach((f) => data.append("attachments", f));
      // Physical metadata
      data.append("widthIn", widthIn);
      data.append("heightIn", heightIn);
      if (depthIn) data.append("depthIn", depthIn);
      if (weightLb) data.append("weightLb", weightLb);
      if (year) data.append("year", year);
      if (medium) data.append("medium", medium);
      if (surface) data.append("surface", surface);
      data.append("framed", framed ? "true" : "false");
      if (sku) data.append("sku", sku);
    }

    const res = await fetch("/api/products/upload", { method: "POST", body: data });
    setUploading(false);

    if (res.ok) {
      alert("Product uploaded!");
      // reset
      setCategory(""); setTitle(""); setDescription(""); setPrice("");
      setVariantType("DIGITAL");
      setMain(null); setThumbnails([]); setFormats([]); setSizes([]); setSvgFile(null);
      setSvgPreviewUrl(null);
      setWidthIn(""); setHeightIn(""); setDepthIn(""); setWeightLb("");
      setYear(""); setMedium(""); setSurface(""); setFramed(false); setSku("");
    } else {
      const err = await res.text().catch(() => "");
      alert("Upload failed");
      console.error(err);
    }
  }

  const isOriginal = variantType === "ORIGINAL";

  return (
    <motion.form
      noValidate
      onSubmit={submit}
      encType="multipart/form-data"
      className="max-w-3xl mx-auto p-8 bg-white rounded-3xl shadow-2xl space-y-8"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Category, Title */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col">
          <label className="mb-2 font-medium text-gray-700">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent transition"
            required
            disabled={uploading}
          >
            <option value="" disabled>Select category</option>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.title} value={opt.title}>{opt.title}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="mb-2 font-medium text-gray-700">Title</label>
          <input
            type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent transition"
            placeholder="Enter title" required disabled={uploading}
          />
        </div>

        {/* NEW: Product Type */}
        <div className="flex flex-col">
          <label className="mb-2 font-medium text-gray-700">Product Type</label>
          <select
            value={variantType}
            onChange={(e) => setVariantType(e.target.value as any)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent transition"
            required
            disabled={uploading}
          >
            <option value="DIGITAL">Digital</option>
            <option value="PRINT">Print</option>
            <option value="ORIGINAL">Original Painting</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="mb-2 font-medium text-gray-700">Price ($)</label>
          <input
            type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent transition"
            placeholder="0.00" required disabled={uploading}
          />
        </div>

        {/* Description (full width) */}
        <div className="flex flex-col md:col-span-2">
          <label className="mb-2 font-medium text-gray-700">Description</label>
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full h-24 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent transition resize-none"
            placeholder="Product description..." required disabled={uploading}
          />
        </div>
      </div>

      {/* ORIGINAL painting fields */}
      {isOriginal && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border rounded-2xl p-4 bg-gray-50">
          <div>
            <label className="block text-sm font-medium text-gray-700">Width (in)</label>
            <input type="number" step="0.01" value={widthIn} onChange={(e) => setWidthIn(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-xl" placeholder="e.g. 24" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Height (in)</label>
            <input type="number" step="0.01" value={heightIn} onChange={(e) => setHeightIn(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-xl" placeholder="e.g. 36" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Depth (in)</label>
            <input type="number" step="0.01" value={depthIn} onChange={(e) => setDepthIn(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-xl" placeholder="e.g. 1.5" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Weight (lb)</label>
            <input type="number" step="0.01" value={weightLb} onChange={(e) => setWeightLb(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-xl" placeholder="e.g. 8" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Year</label>
            <input type="number" value={year} onChange={(e) => setYear(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-xl" placeholder="e.g. 2025" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">SKU</label>
            <input type="text" value={sku} onChange={(e) => setSku(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-xl" placeholder="ORIG-000123" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Medium</label>
            <input type="text" value={medium} onChange={(e) => setMedium(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-xl" placeholder="Oil, Acrylic, Mixed media..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Surface</label>
            <input type="text" value={surface} onChange={(e) => setSurface(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-xl" placeholder="Canvas, Panel, Paper..." />
          </div>
          <div className="flex items-center gap-2">
            <input id="framed" type="checkbox" checked={framed} onChange={(e) => setFramed(e.target.checked)} />
            <label htmlFor="framed" className="text-sm font-medium text-gray-700">Framed</label>
          </div>
        </div>
      )}

      {/* Available Sizes (hide for originals) */}
      {!isOriginal && (
        <div className="flex flex-col space-y-2">
          <label className="font-medium text-gray-700">Available Sizes</label>
          {sizes.map((size, idx) => {
            const valid = size.trim() === "" ? true : SIZE_RE.test(size.trim());
            return (
              <div key={idx} className="flex items-start gap-2">
                <div className="flex-1">
                  <input
                    type="text" inputMode="decimal" value={size}
                    onChange={(e) => updateSize(idx, formatSizeLive(e.target.value))}
                    onBlur={(e) => updateSize(idx, normalizeSizeOnBlur(e.target.value))}
                    placeholder={`e.g. 10" x 12"`} pattern={SIZE_PATTERN}
                    title={`Enter size like 10" x 12", 10x12, 10 in x 12 in, 10.5×12.25`}
                    className={[
                      "w-full px-4 py-2 border rounded-xl transition",
                      valid ? "border-gray-200 focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                            : "border-red-400 focus:ring-2 focus:ring-red-400",
                    ].join(" ")}
                    disabled={uploading}
                  />
                  <div className="mt-1 text-xs">
                    {valid ? (
                      <span className="text-gray-500">
                        Formats accepted: <code>10&quot; x 12&quot;</code>, <code>10x12</code>,
                        <code>10 in x 12 in</code>, <code>10.5×12.25</code>
                      </span>
                    ) : (
                      <span className="text-red-600">Invalid format. Try <code>10&quot; x 12&quot;</code></span>
                    )}
                  </div>
                </div>
                <button type="button" onClick={() => removeSizeField(idx)}
                  className="h-10 px-3 py-1 bg-red-100 text-red-700 rounded-xl hover:bg-red-200"
                  disabled={uploading}>
                  Remove
                </button>
              </div>
            );
          })}
          <button type="button" onClick={addSizeField}
            className="self-start px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600"
            disabled={uploading}>
            + Add Size
          </button>
        </div>
      )}

      {/* Main image, Thumbnails, SVG, Other Formats (SVG/Formats hidden for originals) */}
      {/* Main */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        <div className="flex flex-col">
          <label className="mb-2 font-medium text-gray-700">Main Image</label>
          <label className="flex items-center justify-center px-6 py-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-purple-500 transition">
            {main ? "Change Main Image" : "Select Main Image"}
            <input
              type="file" accept="image/*" className="hidden"
              onChange={(e) => { setMain(e.target.files?.[0] || null); (e.currentTarget as HTMLInputElement).value = ""; }}
              required disabled={uploading}
            />
          </label>
        </div>

        {mainPreview && (
          <div className="relative h-40 w-40 rounded-xl overflow-hidden shadow-lg group">
            <img src={mainPreview} alt="Main Preview" className="object-cover h-full w-full" />
            <button type="button" onClick={() => setMain(null)}
              className="absolute top-2 right-2 h-7 px-2 rounded bg-white/90 text-red-600 text-sm font-semibold shadow opacity-0 group-hover:opacity-100 transition"
              disabled={uploading}>
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Thumbs */}
      <div>
        <label className="mb-2 block font-medium text-gray-700">Thumbnails</label>
        <label className="inline-flex items-center px-6 py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-purple-500 transition">
          {thumbnails.length ? "Add More Thumbnails" : "Select Thumbnails"}
          <input
            type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { appendFiles(e.target.files, setThumbnails); (e.currentTarget as HTMLInputElement).value = ""; }}
            disabled={uploading}
          />
        </label>

        {thumbPreviews.length > 0 && (
          <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-4">
            {thumbPreviews.map((src, idx) => (
              <div key={idx} className="relative h-24 w-24 rounded-lg overflow-hidden shadow-md hover:scale-105 transform transition group">
                <img src={src} alt={`Thumb ${idx + 1}`} className="object-cover h-full w-full" />
                <button type="button" aria-label={`Remove thumbnail ${idx + 1}`}
                  onClick={() => removeThumbnail(idx)}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-white/90 text-red-600 text-sm leading-6 font-bold shadow opacity-0 group-hover:opacity-100 transition"
                  disabled={uploading}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SVG + Other Formats — only for non-original */}
      {!isOriginal && (
        <>
          <div>
            <label className="mb-2 block font-medium text-gray-700">
              SVG File
              <span className="block text-sm text-gray-500">Upload one SVG file. A preview with watermark will be generated automatically.</span>
            </label>
            <label className="inline-flex items-center px-6 py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-purple-500 transition">
              {svgFile ? "Change SVG File" : "Select SVG File"}
              <input
                type="file" accept="image/svg+xml" className="hidden"
                onChange={(e) => { const file = e.target.files?.[0] || null; setSvgFile(file); (e.currentTarget as HTMLInputElement).value = ""; }}
                disabled={uploading}
              />
            </label>

            {svgPreviewUrl && (
              <div className="relative mt-4 h-40 w-40 rounded-xl overflow-hidden shadow-lg group">
                <img src={svgPreviewUrl} alt="SVG Preview" className="object-contain h-full w-full" />
                <button type="button" onClick={() => { setSvgFile(null); setSvgPreviewUrl(null); }}
                  className="absolute top-2 right-2 h-7 px-2 rounded bg-white/90 text-red-600 text-sm font-semibold shadow opacity-0 group-hover:opacity-100 transition"
                  disabled={uploading}>
                  Remove
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="mb-2 block font-medium text-gray-700">Other Formats (PDF, SVG, Images)</label>
            <label className="inline-flex items-center px-6 py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-purple-500 transition">
              {formats.length ? "Add More Formats" : "Select Other Formats"}
              <input
                type="file" accept=".pdf,.svg,image/*" multiple className="hidden"
                onChange={(e) => { appendFiles(e.target.files, setFormats); (e.currentTarget as HTMLInputElement).value = ""; }}
                disabled={uploading}
              />
            </label>

            {formatPreviews.length > 0 && (
              <div className="mt-4 grid grid-cols-4 gap-4">
                {formatPreviews.map(({ url, type }, idx) => (
                  <div key={idx} className="relative h-20 w-20 rounded-lg overflow-hidden shadow-md flex items-center justify-center bg-gray-50 p-2 group">
                    {type.startsWith("image/") ? (
                      <img src={url} alt={`Format ${idx + 1}`} className="object-contain h-full w-full" />
                    ) : type === "application/pdf" ? (
                      <iframe src={url} title={`PDF ${idx + 1}`} className="h-full w-full" />
                    ) : (
                      <span className="text-xs text-gray-600 text-center break-words">{type || "Unsupported"}</span>
                    )}
                    <button type="button" aria-label={`Remove file ${idx + 1}`} onClick={() => removeFormat(idx)}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-white/90 text-red-600 text-sm leading-6 font-bold shadow opacity-0 group-hover:opacity-100 transition"
                      disabled={uploading}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Submit */}
      <motion.button
        type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-500 text-white text-lg font-semibold rounded-2xl shadow-xl hover:opacity-95 transition disabled:opacity-60 disabled:cursor-not-allowed"
        disabled={uploading}
      >
        {uploading ? "Uploading..." : "Create Product"}
      </motion.button>
    </motion.form>
  );
}
