// // PngEditor.tsx (rev 5)
// // In-browser PNG recolor editor (Tailwind-only, no extra deps)

// import React, { useCallback, useEffect, useRef, useState } from "react";

// const DEFAULT_FG = "#000000";
// const DEFAULT_BG = "#ffffff";

// export default function PngEditor() {
//   /* ─────── State ─────── */
//   const [rawDataUrl,   setRawDataUrl]   = useState<string | null>(null);
//   const [fg,           setFg]           = useState(DEFAULT_FG);
//   const [bg,           setBg]           = useState(DEFAULT_BG);
//   const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);
//   const fileInputRef   = useRef<HTMLInputElement>(null);

//   /* ─── Fast compositing logic ─── */
//   const recolor = useCallback(async (dataUrl: string, fgColor: string, bgColor: string) => {
//     const img = new Image();
//     img.src   = dataUrl;
//     await new Promise((res) => (img.onload = res));

//     const w = img.width;
//     const h = img.height;
//     const canvas = document.createElement("canvas");
//     canvas.width  = w;
//     canvas.height = h;
//     const ctx = canvas.getContext("2d")!;

//     // ① fill with background
//     ctx.fillStyle = bgColor;
//     ctx.fillRect(0, 0, w, h);

//     // ② draw original image
//     ctx.drawImage(img, 0, 0);

//     // ③ tint opaque pixels via composite
//     ctx.globalCompositeOperation = "source-in"; 
//     ctx.fillStyle = fgColor;
//     ctx.fillRect(0, 0, w, h);

//     // ④ restore default composite mode
//     ctx.globalCompositeOperation = "source-over";

//     return canvas.toDataURL("image/png");
//   }, []);

//   /* ─── update preview whenever inputs change ─── */
//   useEffect(() => {
//     if (!rawDataUrl) {
//       setPreviewUrl(null);
//       return;
//     }
//     // if defaults, just show original
//     if (fg === DEFAULT_FG && bg === DEFAULT_BG) {
//       setPreviewUrl(rawDataUrl);
//       return;
//     }
//     recolor(rawDataUrl, fg, bg).then(setPreviewUrl);
//   }, [rawDataUrl, fg, bg, recolor]);

//   /* ───── Handlers ───── */
//   const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) return;
//     if (!file.type.startsWith("image/png")) {
//       alert("Please upload a PNG.");
//       return;
//     }
//     // reset to defaults
//     setFg(DEFAULT_FG);
//     setBg(DEFAULT_BG);

//     const reader = new FileReader();
//     reader.onload = () => setRawDataUrl(reader.result as string);
//     reader.readAsDataURL(file);
//   };

//   const triggerUpload = () => fileInputRef.current?.click();

//   const download = () => {
//     if (!previewUrl) return;
//     const a = document.createElement("a");
//     a.href = previewUrl;
//     a.download = "edited.png";
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
//   };

//   /* ───── Render ───── */
//   return (
//     <section className="mx-auto max-w-5xl p-6 font-sans">
//       <div className="rounded-2xl bg-white p-8 shadow-xl">
//         {!rawDataUrl ? (
//           <UploadPrompt
//             triggerUpload={triggerUpload}
//             handleFileChange={handleFile}
//             fileInputRef={fileInputRef}
//             accept=".png,image/png"
//             label="PNG"
//           />
//         ) : (
//           <EditorUI
//             preview={previewUrl}
//             fg={fg}
//             setFg={setFg}
//             bg={bg}
//             setBg={setBg}
//             download={download}
//           />
//         )}
//       </div>
//     </section>
//   );
// }

// function UploadPrompt({
//   triggerUpload,
//   handleFileChange,
//   fileInputRef,
//   accept,
//   label,
// }: {
//   triggerUpload: () => void;
//   handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
//   fileInputRef: React.RefObject<HTMLInputElement>;
//   accept: string;
//   label: string;
// }) {
//   return (
//     <div className="flex flex-col items-center gap-5 text-center">
//       <p className="text-lg font-semibold text-gray-700">
//         Upload a {label} to begin editing
//       </p>
//       <button
//         onClick={triggerUpload}
//         className="rounded-lg border border-indigo-500 bg-indigo-50 px-8 py-2 text-indigo-700 transition hover:bg-indigo-500 hover:text-white"
//       >
//         Select {label} File
//       </button>
//       <input
//         ref={fileInputRef}
//         type="file"
//         accept={accept}
//         onChange={handleFileChange}
//         className="hidden"
//       />
//     </div>
//   );
// }

// function EditorUI({
//   preview,
//   fg,
//   setFg,
//   bg,
//   setBg,
//   download,
// }: {
//   preview: string | null;
//   fg: string;
//   setFg: (v: string) => void;
//   bg: string;
//   setBg: (v: string) => void;
//   download: () => void;
// }) {
//   return (
//     <div className="grid gap-8 md:grid-cols-2">
//       <div className="space-y-6">
//         <ColorPicker label="Tint (recolors image)" value={fg} onChange={setFg} />
//         <ColorPicker label="Background" value={bg} onChange={setBg} />
//         <button
//           onClick={download}
//           className="w-full rounded-lg bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700"
//         >
//           Download PNG
//         </button>
//       </div>
//       <div className="flex h-[32rem] items-center justify-center overflow-auto rounded-xl border bg-gray-50">
//         {preview ? (
//           <img
//             key={preview}
//             src={preview}
//             alt="PNG preview"
//             className="max-h-full max-w-full"
//           />
//         ) : (
//           <p className="text-gray-400">Preview unavailable</p>
//         )}
//       </div>
//     </div>
//   );
// }

// function ColorPicker({
//   label,
//   value,
//   onChange,
// }: {
//   label: string;
//   value: string;
//   onChange: (v: string) => void;
// }) {
//   const handle = (e: React.FormEvent<HTMLInputElement>) =>
//     onChange(e.currentTarget.value);

//   return (
//     <div>
//       <label className="mb-2 block text-sm font-medium text-gray-600">
//         {label} Color
//       </label>
//       <input
//         type="color"
//         value={value}
//         onInput={handle}
//         onChange={handle}
//         className="h-12 w-full cursor-pointer overflow-hidden rounded-lg border"
//       />
//     </div>
//   );
// }
