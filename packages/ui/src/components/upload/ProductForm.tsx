"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  Dispatch,
  SetStateAction,
} from "react";
import { motion } from "framer-motion";
import categories from "@acme/core/data/categories";
import {
  formatSizeLive,
  normalizeSizeOnBlur,
  SIZE_PATTERN,
  SIZE_RE,
} from "@acme/core/utils/helpers";

type VariantType = "DIGITAL" | "PRINT" | "ORIGINAL";
type ProductKind =
  | "ART"
  | "STICKER"
  | "MUG"
  | "CARD"
  | "BOOK_DIGITAL"
  | "OTHER";

type Visibility = {
  productTypeSelect: boolean;
  sizes: boolean;
  originalFields: boolean;
  svgBlock: boolean;
  formatsBlock: boolean;

  // per-kind subsections
  stickerFields: boolean;
  mugFields: boolean;
  cardFields: boolean;
  bookFields: boolean;
};

const KIND_DEFAULT_TYPE: Partial<Record<ProductKind, VariantType>> = {
  ART: "DIGITAL",
  STICKER: "PRINT",
  MUG: "PRINT",
  CARD: "PRINT",
  BOOK_DIGITAL: "DIGITAL",
  OTHER: "DIGITAL",
};

function sameFile(a: File, b: File) {
  return (
    a.name === b.name &&
    a.size === b.size &&
    a.lastModified === b.lastModified
  );
}

function appendFiles(
  files: FileList | null,
  setter: Dispatch<SetStateAction<File[]>>
) {
  if (!files) return;
  const incoming = Array.from(files);
  setter((prev) => {
    const next = [...prev];
    for (const f of incoming) if (!prev.some((p) => sameFile(p, f))) next.push(f);
    return next;
  });
}

// ————————— Visibility matrix —————————
function computeVisibility(kind: ProductKind, type: VariantType): Visibility {
  if (kind === "STICKER") {
    return {
      productTypeSelect: false,
      sizes: true,
      originalFields: false,
      svgBlock: false,
      formatsBlock: false,
      stickerFields: true,
      mugFields: false,
      cardFields: false,
      bookFields: false,
    };
  }

  if (kind === "MUG") {
    return {
      productTypeSelect: false,
      sizes: false, // we’ll select sizes via checkboxes (11oz/15oz)
      originalFields: false,
      svgBlock: false,
      formatsBlock: false,
      stickerFields: false,
      mugFields: true,
      cardFields: false,
      bookFields: false,
    };
  }

  if (kind === "CARD") {
    return {
      productTypeSelect: false,
      sizes: true, // default to 2.5"x3.5", editable
      originalFields: false,
      svgBlock: false,
      formatsBlock: false,
      stickerFields: false,
      mugFields: false,
      cardFields: true,
      bookFields: false,
    };
  }

  if (kind === "BOOK_DIGITAL") {
    return {
      productTypeSelect: false,
      sizes: false,
      originalFields: false,
      svgBlock: false,
      formatsBlock: true, // PDF/EPUB uploads
      stickerFields: false,
      mugFields: false,
      cardFields: false,
      bookFields: true, // ISBN, pageCount, language
    };
  }

  // ART / OTHER follow selected type
  if (type === "ORIGINAL") {
    return {
      productTypeSelect: true,
      sizes: false,
      originalFields: true,
      svgBlock: false,
      formatsBlock: false,
      stickerFields: false,
      mugFields: false,
      cardFields: false,
      bookFields: false,
    };
  }

  const isDigital = type === "DIGITAL";
  return {
    productTypeSelect: true,
    sizes: !isDigital,
    originalFields: false,
    svgBlock: isDigital,
    formatsBlock: true, // allow PNG/PDF for both digital or print
    stickerFields: false,
    mugFields: false,
    cardFields: false,
    bookFields: false,
  };
}

export default function ProductForm() {
  // Kind and type
  const [kind, setKind] = useState<ProductKind>("ART");
  const [variantType, setVariantType] = useState<VariantType>("DIGITAL");

  // Base product fields
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");

  // Original fields
  const [widthIn, setWidthIn] = useState<string>("");
  const [heightIn, setHeightIn] = useState<string>("");
  const [depthIn, setDepthIn] = useState<string>("");
  const [weightLb, setWeightLb] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [medium, setMedium] = useState<string>("");
  const [surface, setSurface] = useState<string>("");
  const [framed, setFramed] = useState<boolean>(false);
  const [sku, setSku] = useState<string>("");

  // Media
  const [main, setMain] = useState<File | null>(null);
  const [thumbnails, setThumbnails] = useState<File[]>([]);
  const [formats, setFormats] = useState<File[]>([]);
  const [svgFile, setSvgFile] = useState<File | null>(null);

  const [mainPreview, setMainPreview] = useState<string | null>(null);
  const [thumbPreviews, setThumbPreviews] = useState<string[]>([]);
  const [formatPreviews, setFormatPreviews] = useState<
    { url: string; type: string }[]
  >([]);
  const [svgPreviewUrl, setSvgPreviewUrl] = useState<string | null>(null);

  // Shared UI
  const [uploading, setUploading] = useState(false);
  const [sizes, setSizes] = useState<string[]>([]);
  const CATEGORY_OPTIONS = useMemo(() => categories, []);

  // ——— Per-kind attributes (will be packed into JSON and sent as "kindAttributes") ———
  // STICKER
  const [stickerMaterial, setStickerMaterial] = useState("Matte Vinyl");
  const [stickerFinish, setStickerFinish] = useState("Matte");
  const [stickerCut, setStickerCut] = useState("Die-cut"); // Die-cut | Kiss-cut | Sheet
  const [stickerPackQty, setStickerPackQty] = useState<number>(1);

  // MUG
  const [mug11oz, setMug11oz] = useState(true);
  const [mug15oz, setMug15oz] = useState(false);
  const [mugColor, setMugColor] = useState("White"); // White, Black, Two-Tone
  const [mugDishwasherSafe, setMugDishwasherSafe] = useState(true);

  // CARD
  const [cardStock, setCardStock] = useState("310gsm");
  const [cardFinish, setCardFinish] = useState("Smooth"); // Smooth | Linen
  const [cardPackQty, setCardPackQty] = useState<number>(54);

  // BOOK_DIGITAL
  const [bookIsbn, setBookIsbn] = useState("");
  const [bookPages, setBookPages] = useState<number | "">("");
  const [bookLanguage, setBookLanguage] = useState("English");

  // ——— Kind/type syncing ———
  useEffect(() => {
    const fixed = KIND_DEFAULT_TYPE[kind];
    if (fixed) {
      setVariantType(fixed);
    }
  }, [kind]);

  const vis = useMemo(
    () => computeVisibility(kind, variantType),
    [kind, variantType]
  );

  // Presets & clear irrelevant inputs when visibility changes
  useEffect(() => {
    // Prefill sizes for specific kinds if empty
    if (vis.sizes && sizes.length === 0) {
      if (kind === "STICKER") setSizes([`3" x 3"`, `4" x 4"`, `5" x 5"`]);
      if (kind === "CARD") setSizes([`2.5" x 3.5"`]);
    }

    // Clear sections that are now hidden
    if (!vis.sizes) setSizes([]);
    if (!vis.svgBlock) {
      setSvgFile(null);
      setSvgPreviewUrl(null);
    }
    if (!vis.formatsBlock) setFormats([]);
    if (!vis.originalFields) {
      setWidthIn("");
      setHeightIn("");
      setDepthIn("");
      setWeightLb("");
      setYear("");
      setMedium("");
      setSurface("");
      setFramed(false);
      setSku("");
    }
  }, [vis]); // eslint-disable-line

  // previews
  useEffect(() => {
    if (!main) {
      setMainPreview(null);
      return;
    }
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
    const previews = formats.map((f) => ({
      url: URL.createObjectURL(f),
      type: f.type,
    }));
    setFormatPreviews(previews);
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [formats]);

  useEffect(() => {
    if (!svgFile) {
      setSvgPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(svgFile);
    setSvgPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [svgFile]);

  // size helpers
  const addSizeField = () => setSizes((s) => [...s, ""]);
  const updateSize = (idx: number, val: string) => {
    setSizes((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };
  const removeSizeField = (idx: number) =>
    setSizes((prev) => prev.filter((_, i) => i !== idx));

  const removeThumbnail = (idx: number) =>
    setThumbnails((prev) => prev.filter((_, i) => i !== idx));
  const removeFormat = (idx: number) =>
    setFormats((prev) => prev.filter((_, i) => i !== idx));

  // ——— Submit ———
  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const fixed = KIND_DEFAULT_TYPE[kind];
    const effectiveType = fixed ?? variantType;

    if (!main) {
      alert("Please select a main image");
      return;
    }

    // Validation based on effective type
    if (effectiveType === "ORIGINAL") {
      if (!widthIn || !heightIn) {
        alert("Please provide width and height (inches).");
        return;
      }
    } else {
      // DIGITAL or PRINT
      if (vis.sizes) {
        const firstBad = sizes.findIndex(
          (s) => s.trim() !== "" && !SIZE_RE.test(s.trim())
        );
        if (firstBad !== -1) {
          const badVal = sizes[firstBad];
          alert(
            `Invalid size at row ${firstBad + 1}: "${badVal}". Use a format like 10" x 12".`
          );
          return;
        }
      }
    }

    // Build kindAttributes (only what’s needed for this kind)
    const kindAttributes: Record<string, any> = {};
    if (kind === "STICKER") {
      kindAttributes.material = stickerMaterial;
      kindAttributes.finish = stickerFinish;
      kindAttributes.cutType = stickerCut;
      kindAttributes.packQuantity = stickerPackQty || 1;
    }
    if (kind === "MUG") {
      const selectedSizes: string[] = [];
      if (mug11oz) selectedSizes.push("11oz");
      if (mug15oz) selectedSizes.push("15oz");
      // reflect mug sizes as variants; also include attributes
      kindAttributes.mugColor = mugColor;
      kindAttributes.dishwasherSafe = mugDishwasherSafe;
      kindAttributes.selectedSizes = selectedSizes;
      // ensure sizes array mirrors selectedSizes (backend also reads kindAttributes)
    }
    if (kind === "CARD") {
      kindAttributes.stock = cardStock;
      kindAttributes.finish = cardFinish;
      kindAttributes.packQuantity = cardPackQty || 54;
    }
    if (kind === "BOOK_DIGITAL") {
      if (bookIsbn) kindAttributes.isbn = bookIsbn;
      if (bookPages) kindAttributes.pageCount = Number(bookPages);
      kindAttributes.language = bookLanguage;
    }

    setUploading(true);
    const data = new FormData();
    data.append("kind", kind);
    data.append("variantType", effectiveType);
    data.append("category", category);
    data.append("title", title);
    data.append("description", description);
    data.append("price", price);
    data.append("main", main);

    // Media blocks
    thumbnails.forEach((f) => data.append("thumbnails", f));

    // Blocks by visibility
    if (vis.sizes) {
      // for MUG we’ll also reflect checkbox sizes here:
      if (kind === "MUG") {
        const mugSizes: string[] = [];
        if (mug11oz) mugSizes.push("11oz");
        if (mug15oz) mugSizes.push("15oz");
        (mugSizes.length ? mugSizes : ["11oz"]).forEach((s) =>
          data.append("sizes", s)
        );
      } else {
        sizes.forEach((s) => data.append("sizes", s));
      }
    }

    if (vis.svgBlock && svgFile) data.append("svg", svgFile);
    if (vis.formatsBlock) formats.forEach((f) => data.append("formats", f));

    if (vis.originalFields) {
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

    // attach attributes JSON
    if (Object.keys(kindAttributes).length > 0) {
      data.append("kindAttributes", JSON.stringify(kindAttributes));
    }

    const res = await fetch("/api/products/upload", {
      method: "POST",
      body: data,
    });
    setUploading(false);

    if (res.ok) {
      alert("Product uploaded!");
      // reset
      setKind("ART");
      setVariantType("DIGITAL");
      setCategory("");
      setTitle("");
      setDescription("");
      setPrice("");
      setMain(null);
      setThumbnails([]);
      setFormats([]);
      setSvgFile(null);
      setSvgPreviewUrl(null);
      setSizes([]);

      // reset per-kind
      setStickerMaterial("Matte Vinyl");
      setStickerFinish("Matte");
      setStickerCut("Die-cut");
      setStickerPackQty(1);

      setMug11oz(true);
      setMug15oz(false);
      setMugColor("White");
      setMugDishwasherSafe(true);

      setCardStock("310gsm");
      setCardFinish("Smooth");
      setCardPackQty(54);

      setBookIsbn("");
      setBookPages("");
      setBookLanguage("English");

      // original
      setWidthIn("");
      setHeightIn("");
      setDepthIn("");
      setWeightLb("");
      setYear("");
      setMedium("");
      setSurface("");
      setFramed(false);
      setSku("");
    } else {
      const err = await res.text().catch(() => "");
      alert("Upload failed");
      console.error(err);
    }
  }

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
      {/* Category / Title */}
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
            <option value="" disabled>
              Select category
            </option>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.title} value={opt.title}>
                {opt.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="mb-2 font-medium text-gray-700">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent transition"
            placeholder="Enter title"
            required
            disabled={uploading}
          />
        </div>

        {/* Kind */}
        <div className="flex flex-col">
          <label className="mb-2 font-medium text-gray-700">Product Kind</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ProductKind)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent transition"
            required
            disabled={uploading}
          >
            <option value="ART">Art</option>
            <option value="STICKER">Sticker</option>
            <option value="MUG">Mug</option>
            <option value="CARD">Card</option>
            <option value="BOOK_DIGITAL">Book (Digital)</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        {/* Type (only when allowed by kind) */}
        {vis.productTypeSelect && (
          <div className="flex flex-col">
            <label className="mb-2 font-medium text-gray-700">Product Type</label>
            <select
              value={variantType}
              onChange={(e) => setVariantType(e.target.value as VariantType)}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent transition"
              required
              disabled={uploading}
            >
              <option value="DIGITAL">Digital</option>
              <option value="PRINT">Print</option>
              <option value="ORIGINAL">Original</option>
            </select>
          </div>
        )}

        {/* Price */}
        <div className="flex flex-col md:col-span-2">
          <label className="mb-2 font-medium text-gray-700">Price ($)</label>
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent transition"
            placeholder="0.00"
            required
            disabled={uploading}
          />
        </div>

        {/* Description */}
        <div className="flex flex-col md:col-span-2">
          <label className="mb-2 font-medium text-gray-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full h-24 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent transition resize-none"
            placeholder="Product description..."
            required
            disabled={uploading}
          />
        </div>
      </div>

      {/* ORIGINAL fields */}
      {vis.originalFields && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border rounded-2xl p-4 bg-gray-50">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Width (in)
            </label>
            <input
              type="number"
              step="0.01"
              value={widthIn}
              onChange={(e) => setWidthIn(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-xl"
              placeholder="e.g. 24"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Height (in)
            </label>
            <input
              type="number"
              step="0.01"
              value={heightIn}
              onChange={(e) => setHeightIn(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-xl"
              placeholder="e.g. 36"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Depth (in)
            </label>
            <input
              type="number"
              step="0.01"
              value={depthIn}
              onChange={(e) => setDepthIn(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-xl"
              placeholder="e.g. 1.5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Weight (lb)
            </label>
            <input
              type="number"
              step="0.01"
              value={weightLb}
              onChange={(e) => setWeightLb(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-xl"
              placeholder="e.g. 8"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Year
            </label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-xl"
              placeholder="e.g. 2025"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              SKU
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-xl"
              placeholder="ORIG-000123"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Medium
            </label>
            <input
              type="text"
              value={medium}
              onChange={(e) => setMedium(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-xl"
              placeholder="Oil, Acrylic, Mixed media..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Surface
            </label>
            <input
              type="text"
              value={surface}
              onChange={(e) => setSurface(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-xl"
              placeholder="Canvas, Panel, Paper..."
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="framed"
              type="checkbox"
              checked={framed}
              onChange={(e) => setFramed(e.target.checked)}
            />
            <label htmlFor="framed" className="text-sm font-medium text-gray-700">
              Framed
            </label>
          </div>
        </div>
      )}

      {/* STICKER sub-form */}
      {vis.stickerFields && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border rounded-2xl p-4 bg-gray-50">
          <div>
            <label className="block text-sm font-medium text-gray-700">Material</label>
            <select
              className="mt-1 w-full px-3 py-2 border rounded-xl"
              value={stickerMaterial}
              onChange={(e) => setStickerMaterial(e.target.value)}
              disabled={uploading}
            >
              <option>Matte Vinyl</option>
              <option>Gloss Vinyl</option>
              <option>Clear Vinyl</option>
              <option>Holographic</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Finish</label>
            <select
              className="mt-1 w-full px-3 py-2 border rounded-xl"
              value={stickerFinish}
              onChange={(e) => setStickerFinish(e.target.value)}
              disabled={uploading}
            >
              <option>Matte</option>
              <option>Gloss</option>
              <option>Satin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Cut Type</label>
            <select
              className="mt-1 w-full px-3 py-2 border rounded-xl"
              value={stickerCut}
              onChange={(e) => setStickerCut(e.target.value)}
              disabled={uploading}
            >
              <option>Die-cut</option>
              <option>Kiss-cut</option>
              <option>Sheet</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Pack Qty</label>
            <input
              type="number"
              min={1}
              className="mt-1 w-full px-3 py-2 border rounded-xl"
              value={stickerPackQty}
              onChange={(e) => setStickerPackQty(Math.max(1, Number(e.target.value || 1)))}
            />
          </div>
        </div>
      )}

      {/* MUG sub-form */}
      {vis.mugFields && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border rounded-2xl p-4 bg-gray-50">
          <div className="col-span-1 md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sizes
            </label>
            <div className="flex items-center gap-6">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mug11oz}
                  onChange={(e) => setMug11oz(e.target.checked)}
                />
                <span>11oz</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mug15oz}
                  onChange={(e) => setMug15oz(e.target.checked)}
                />
                <span>15oz</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Color</label>
            <select
              className="mt-1 w-full px-3 py-2 border rounded-xl"
              value={mugColor}
              onChange={(e) => setMugColor(e.target.value)}
            >
              <option>White</option>
              <option>Black</option>
              <option>Two-Tone</option>
            </select>
          </div>
          <label className="inline-flex items-center gap-2 mt-6">
            <input
              type="checkbox"
              checked={mugDishwasherSafe}
              onChange={(e) => setMugDishwasherSafe(e.target.checked)}
            />
            <span className="text-sm font-medium text-gray-700">Dishwasher Safe</span>
          </label>
        </div>
      )}

      {/* CARD sub-form */}
      {vis.cardFields && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border rounded-2xl p-4 bg-gray-50">
          <div>
            <label className="block text-sm font-medium text-gray-700">Stock</label>
            <select
              className="mt-1 w-full px-3 py-2 border rounded-xl"
              value={cardStock}
              onChange={(e) => setCardStock(e.target.value)}
            >
              <option>300gsm</option>
              <option>310gsm</option>
              <option>330gsm</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Finish</label>
            <select
              className="mt-1 w-full px-3 py-2 border rounded-xl"
              value={cardFinish}
              onChange={(e) => setCardFinish(e.target.value)}
            >
              <option>Smooth</option>
              <option>Linen</option>
              <option>UV Coated</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Pack Qty</label>
            <input
              type="number"
              min={1}
              className="mt-1 w-full px-3 py-2 border rounded-xl"
              value={cardPackQty}
              onChange={(e) => setCardPackQty(Math.max(1, Number(e.target.value || 1)))}
            />
          </div>
        </div>
      )}

      {/* BOOK_DIGITAL sub-form */}
      {vis.bookFields && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border rounded-2xl p-4 bg-gray-50">
          <div>
            <label className="block text-sm font-medium text-gray-700">ISBN</label>
            <input
              type="text"
              className="mt-1 w-full px-3 py-2 border rounded-xl"
              value={bookIsbn}
              onChange={(e) => setBookIsbn(e.target.value)}
              placeholder="ISBN-13"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Pages</label>
            <input
              type="number"
              min={1}
              className="mt-1 w-full px-3 py-2 border rounded-xl"
              value={bookPages}
              onChange={(e) => setBookPages(e.target.value ? Number(e.target.value) : "")}
              placeholder="e.g. 120"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Language</label>
            <input
              type="text"
              className="mt-1 w-full px-3 py-2 border rounded-xl"
              value={bookLanguage}
              onChange={(e) => setBookLanguage(e.target.value)}
              placeholder="English"
            />
          </div>
        </div>
      )}

      {/* Sizes block (used by PRINT for many kinds; hidden for MUG where we use checkboxes) */}
      {vis.sizes && (
        <div className="flex flex-col space-y-2">
          <label className="font-medium text-gray-700">Available Sizes</label>
          {sizes.map((size, idx) => {
            const valid = size.trim() === "" ? true : SIZE_RE.test(size.trim());
            return (
              <div key={idx} className="flex items-start gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={size}
                    onChange={(e) => updateSize(idx, formatSizeLive(e.target.value))}
                    onBlur={(e) => updateSize(idx, normalizeSizeOnBlur(e.target.value))}
                    placeholder={`e.g. 10" x 12"`}
                    pattern={SIZE_PATTERN}
                    title={`Enter size like 10" x 12", 10x12, 10 in x 12 in, 10.5×12.25`}
                    className={[
                      "w-full px-4 py-2 border rounded-xl transition",
                      valid
                        ? "border-gray-200 focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                        : "border-red-400 focus:ring-2 focus:ring-red-400",
                    ].join(" ")}
                    disabled={uploading}
                  />
                  <div className="mt-1 text-xs">
                    {valid ? (
                      <span className="text-gray-500">
                        Formats accepted: <code>10&quot; x 12&quot;</code>,{" "}
                        <code>10x12</code>, <code>10 in x 12 in</code>,{" "}
                        <code>10.5×12.25</code>
                      </span>
                    ) : (
                      <span className="text-red-600">
                        Invalid format. Try <code>10&quot; x 12&quot;</code>
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeSizeField(idx)}
                  className="h-10 px-3 py-1 bg-red-100 text-red-700 rounded-xl hover:bg-red-200"
                  disabled={uploading}
                >
                  Remove
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={addSizeField}
            className="self-start px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600"
            disabled={uploading}
          >
            + Add Size
          </button>
        </div>
      )}

      {/* Media — Main */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        <div className="flex flex-col">
          <label className="mb-2 font-medium text-gray-700">Main Image</label>
          <label className="flex items-center justify-center px-6 py-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-purple-500 transition">
            {main ? "Change Main Image" : "Select Main Image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                setMain(e.target.files?.[0] || null);
                (e.currentTarget as HTMLInputElement).value = "";
              }}
              required
              disabled={uploading}
            />
          </label>
        </div>

        {mainPreview && (
          <div className="relative h-40 w-40 rounded-xl overflow-hidden shadow-lg group">
            <img
              src={mainPreview}
              alt="Main Preview"
              className="object-cover h-full w-full"
            />
            <button
              type="button"
              onClick={() => setMain(null)}
              className="absolute top-2 right-2 h-7 px-2 rounded bg-white/90 text-red-600 text-sm font-semibold shadow opacity-0 group-hover:opacity-100 transition"
              disabled={uploading}
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      <div>
        <label className="mb-2 block font-medium text-gray-700">Thumbnails</label>
        <label className="inline-flex items-center px-6 py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-purple-500 transition">
          {thumbnails.length ? "Add More Thumbnails" : "Select Thumbnails"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              appendFiles(e.target.files, setThumbnails);
              (e.currentTarget as HTMLInputElement).value = "";
            }}
            disabled={uploading}
          />
        </label>

        {thumbPreviews.length > 0 && (
          <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-4">
            {thumbPreviews.map((src, idx) => (
              <div
                key={idx}
                className="relative h-24 w-24 rounded-lg overflow-hidden shadow-md hover:scale-105 transform transition group"
              >
                <img src={src} alt={`Thumb ${idx + 1}`} className="object-cover h-full w-full" />
                <button
                  type="button"
                  aria-label={`Remove thumbnail ${idx + 1}`}
                  onClick={() => removeThumbnail(idx)}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-white/90 text-red-600 text-sm leading-6 font-bold shadow opacity-0 group-hover:opacity-100 transition"
                  disabled={uploading}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SVG (DIGITAL for ART/OTHER) */}
      {vis.svgBlock && (
        <div>
          <label className="mb-2 block font-medium text-gray-700">
            SVG File
            <span className="block text-sm text-gray-500">
              Upload one SVG file. A watermarked preview will be generated.
            </span>
          </label>
          <label className="inline-flex items-center px-6 py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-purple-500 transition">
            {svgFile ? "Change SVG File" : "Select SVG File"}
            <input
              type="file"
              accept="image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setSvgFile(file);
                (e.currentTarget as HTMLInputElement).value = "";
              }}
              disabled={uploading}
            />
          </label>

          {svgPreviewUrl && (
            <div className="relative mt-4 h-40 w-40 rounded-xl overflow-hidden shadow-lg group">
              <img
                src={svgPreviewUrl}
                alt="SVG Preview"
                className="object-contain h-full w-full"
              />
              <button
                type="button"
                onClick={() => {
                  setSvgFile(null);
                  setSvgPreviewUrl(null);
                }}
                className="absolute top-2 right-2 h-7 px-2 rounded bg-white/90 text-red-600 text-sm font-semibold shadow opacity-0 group-hover:opacity-100 transition"
                disabled={uploading}
              >
                Remove
              </button>
            </div>
          )}
        </div>
      )}

      {/* Other Formats (PNG/PDF/EPUB etc.) */}
      {vis.formatsBlock && (
        <div>
          <label className="mb-2 block font-medium text-gray-700">
            Other Formats (PDF, SVG, Images)
          </label>
          <label className="inline-flex items-center px-6 py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-purple-500 transition">
            {formats.length ? "Add More Formats" : "Select Other Formats"}
            <input
              type="file"
              accept=".pdf,.epub,.svg,image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                appendFiles(e.target.files, setFormats);
                (e.currentTarget as HTMLInputElement).value = "";
              }}
              disabled={uploading}
            />
          </label>

          {formatPreviews.length > 0 && (
            <div className="mt-4 grid grid-cols-4 gap-4">
              {formatPreviews.map(({ url, type }, idx) => (
                <div
                  key={idx}
                  className="relative h-20 w-20 rounded-lg overflow-hidden shadow-md flex items-center justify-center bg-gray-50 p-2 group"
                >
                  {type.startsWith("image/") ? (
                    <img
                      src={url}
                      alt={`Format ${idx + 1}`}
                      className="object-contain h-full w-full"
                    />
                  ) : type === "application/pdf" || type === "application/epub+zip" ? (
                    <iframe src={url} title={`Doc ${idx + 1}`} className="h-full w-full" />
                  ) : (
                    <span className="text-xs text-gray-600 text-center break-words">
                      {type || "File"}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove file ${idx + 1}`}
                    onClick={() => removeFormat(idx)}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-white/90 text-red-600 text-sm leading-6 font-bold shadow opacity-0 group-hover:opacity-100 transition"
                    disabled={uploading}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <motion.button
        type="submit"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-500 text-white text-lg font-semibold rounded-2xl shadow-xl hover:opacity-95 transition disabled:opacity-60 disabled:cursor-not-allowed"
        disabled={uploading}
      >
        {uploading ? "Uploading..." : "Create Product"}
      </motion.button>
    </motion.form>
  );
}
