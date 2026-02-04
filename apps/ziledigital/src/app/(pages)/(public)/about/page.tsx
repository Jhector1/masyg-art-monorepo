"use client";

// import {TestBlock} from "../TestBlock";
import SEO from "@acme/ui/components/SEO";
import {AboutComponent} from "@acme/ui/components/AboutComponent";

// import { TestBlock } from "../TestBlock";


export default function AboutPage() {
  return (
    <>
      <SEO
        title="Haitian Digital Art Gallery"
        description="Buy and explore uniquely crafted Haitian vector artworks."
      />
      {/* <TestBlock/> */}
     <AboutComponent/>
    </>
  );
}
