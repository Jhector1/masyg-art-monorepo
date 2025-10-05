// components/DigitalCardCustomizer/components/Tabs.tsx
"use client";
import React from "react";

export type TabKey = "backgrounds" | "elements" | "selected" | "card";

interface TabsProps {
  current: TabKey;
  setCurrent: React.Dispatch<React.SetStateAction<TabKey>>;
  hasSelected?: boolean;
}

export function Tabs({ current, setCurrent, hasSelected = false }: TabsProps) {
  return (
    <div className="rc-tabs">
      <button
        className={`rc-tab ${current === "backgrounds" ? "is-active" : ""}`}
        onClick={() => setCurrent("backgrounds")}
      >
        Backgrounds
      </button>

      <button
        className={`rc-tab ${current === "elements" ? "is-active" : ""}`}
        onClick={() => setCurrent("elements")}
      >
        Elements
      </button>

      <button
        className={`rc-tab ${current === "selected" ? "is-active" : ""}`}
        onClick={() => setCurrent("selected")}
        disabled={!hasSelected}
        title={!hasSelected ? "Select an element to edit" : ""}
      >
        Selected
      </button>

      <button
        className={`rc-tab ${current === "card" ? "is-active" : ""}`}
        onClick={() => setCurrent("card")}
      >
        Card
      </button>
    </div>
  );
}
