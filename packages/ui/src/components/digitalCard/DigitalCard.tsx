"use client";

import React, { useState } from "react";
import html2canvas from "html2canvas";
import RealisticGreetingCard from "./RealisticGreetingCard";

export default function DigitalCard() {
  const [exporting, setExporting] = useState(false);

  const exportCard = async () => {
    const node = document.getElementById("card-preview");
    if (!node) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(node, { backgroundColor: null, useCORS: true });
      const data = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = data;
      a.download = "digital_card_view.png";
      a.click();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 text-center">
      <h1 className="text-3xl font-bold">Create a Hyperrealistic Digital Card</h1>

      <RealisticGreetingCard width={700} height={420} />

      <button
        onClick={exportCard}
        disabled={exporting}
        className="mt-2 px-6 py-2 bg-indigo-600 text-white rounded-lg shadow disabled:opacity-60"
      >
        {exporting ? "Exporting…" : "Save / Download Current View"}
      </button>
    </div>
  );
}
