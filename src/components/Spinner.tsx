export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-brand-ink/60">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-red border-t-transparent" />
      {label && <span className="text-sm font-medium">{label}</span>}
    </div>
  )
}

export function FullScreenLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-cream">
      <Spinner label={label || 'Chargement…'} />
    </div>
  )
}
