import { ReactNode } from "react";

export default function PageSection({
  children,
  className = "",
  id,
}: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`py-12 sm:py-16 lg:py-24 ${className}`}>
      {children}
    </section>
  );
}
