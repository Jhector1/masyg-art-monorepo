// src/components/editor/contexts/DesignContext.tsx
"use client";

import React, { useCallback } from "react";
import type { StyleState } from "../types";

type DefsMap = Record<string, string>;
type Snapshot = { style: StyleState; defsMap: DefsMap; label?: string };

type Hist = { items: Snapshot[]; i: number };

type DesignContextValue = {
  style: StyleState;
  defsMap: DefsMap;

  setStyle: React.Dispatch<React.SetStateAction<StyleState>>;
  setDefsMap: React.Dispatch<React.SetStateAction<DefsMap>>;

  handleStyleChange: <K extends keyof StyleState>(key: K, value: StyleState[K]) => void;

  beginHistory: (label?: string) => void;
  commitHistory: (label?: string) => void;
  cancelHistory: () => void;

  setDefsMapWithHistory: (next: DefsMap, label?: string) => void;

  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

const DesignContext = React.createContext<DesignContextValue | null>(null);
const MAX_STEPS = 100;

function cloneSnap(s: Snapshot): Snapshot {
  return { style: { ...s.style }, defsMap: { ...s.defsMap }, label: s.label };
}

export function DesignProvider({
  initialStyle,
  initialDefsMap = {},
  children,
}: {
  initialStyle: StyleState;
  initialDefsMap?: DefsMap;
  children: React.ReactNode;
}) {
  const [style, setStyle] = React.useState<StyleState>(initialStyle);
  const [defsMap, setDefsMap] = React.useState<DefsMap>(initialDefsMap);

  // Timeline + pointer in one state
  const [hist, setHist] = React.useState<Hist>({
    items: [{ style: initialStyle, defsMap: { ...initialDefsMap } }],
    i: 0,
  });

  // Batch marker (pre-change snapshot) & pending commit label
  const preSnapRef = React.useRef<Snapshot | null>(null);
  const pendingCommitLabelRef = React.useRef<string | undefined>(undefined);

  const applySnapshot = React.useCallback((s: Snapshot) => {
    setStyle(s.style);
    setDefsMap(s.defsMap);
  }, []);

  // Push a snapshot of *current* state into history (forks after undo)
  const pushCurrent = React.useCallback((label?: string) => {
    setHist((prev) => {
      const base = prev.items.slice(0, prev.i + 1);
      const snap: Snapshot = { style: { ...style }, defsMap: { ...defsMap }, label };
      let items = [...base, snap];
      let i = items.length - 1;
      if (items.length > MAX_STEPS) {
        items = items.slice(items.length - MAX_STEPS);
        i = items.length - 1;
      }
      return { items, i };
    });
  }, [style, defsMap]);

  // When style/defsMap change and a commit is pending, push the NEW state
  React.useEffect(() => {
    if (!pendingCommitLabelRef.current) return;
    const label = pendingCommitLabelRef.current;
    pendingCommitLabelRef.current = undefined;
    pushCurrent(label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, defsMap]);

  // Public history API
  const beginHistory = React.useCallback((label?: string) => {
    preSnapRef.current = { style: { ...style }, defsMap: { ...defsMap }, label };
  }, [style, defsMap]);

  const cancelHistory = React.useCallback(() => {
    if (!preSnapRef.current) return;
    pendingCommitLabelRef.current = undefined;
    applySnapshot(cloneSnap(preSnapRef.current));
    preSnapRef.current = null;
  }, [applySnapshot]);

  const commitHistory = React.useCallback((label?: string) => {
    // Defer commit until after React applies the state updates
    pendingCommitLabelRef.current = label ?? preSnapRef.current?.label;
    preSnapRef.current = null;
  }, []);

  const undo = React.useCallback(() => {
    setHist((prev) => {
      if (prev.i <= 0) return prev;
      const i = prev.i - 1;
      applySnapshot(cloneSnap(prev.items[i]));
      return { ...prev, i };
    });
  }, [applySnapshot]);

  const redo = React.useCallback(() => {
    setHist((prev) => {
      if (prev.i >= prev.items.length - 1) return prev;
      const i = prev.i + 1;
      applySnapshot(cloneSnap(prev.items[i]));
      return { ...prev, i };
    });
  }, [applySnapshot]);

  const canUndo = hist.i > 0;
  const canRedo = hist.i < hist.items.length - 1;

  // Core updates
// in DesignContext (pseudo)
const handleStyleChange = useCallback(<K extends keyof StyleState>(key: K, val: StyleState[K]) => {
  setStyle((prev) => {
    // build from previous to avoid stale snapshots
    const next = { ...prev, [key]: val };
    return next;
  });
}, [setStyle]);


  // One-shot helper that creates a single step for defs changes
  const setDefsMapWithHistory = React.useCallback(
    (next: DefsMap, label?: string) => {
      beginHistory(label ?? "Update defs");
      setDefsMap(next);
      commitHistory(label ?? "Update defs");
    },
    [beginHistory, commitHistory]
  );

  const value: DesignContextValue = {
    style,
    defsMap,

    setStyle,
    setDefsMap,

    handleStyleChange,

    beginHistory,
    commitHistory,
    cancelHistory,
    setDefsMapWithHistory,

    undo,
    redo,
    canUndo,
    canRedo,
  };

  return <DesignContext.Provider value={value}>{children}</DesignContext.Provider>;
}

export function useDesignContext() {
  const ctx = React.useContext(DesignContext);
  if (!ctx) throw new Error("useDesignContext must be used inside DesignProvider");
  return ctx;
}
