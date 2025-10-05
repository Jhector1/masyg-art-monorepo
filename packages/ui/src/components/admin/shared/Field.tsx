export function Field({ label, htmlFor, children, help }: { label: string; htmlFor?: string; children: React.ReactNode; help?: React.ReactNode }) {
  const labelBase = "text-sm font-medium text-neutral-800";
  const helpBase = "text-xs text-neutral-500";
    return (
    <div className="grid gap-2">
      <label className={labelBase} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {help ? <p className={helpBase}>{help}</p> : null}
    </div>
  );
}
