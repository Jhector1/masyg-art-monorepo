// File: components/DigitalCardWrapper.tsx
"use client";

import dynamic from "next/dynamic";

const DigitalCard = dynamic(() => import("./DigitalCard"), {
  ssr: false,
});

export default function DigitalCardWrapper() {
  return <DigitalCard />;
}
