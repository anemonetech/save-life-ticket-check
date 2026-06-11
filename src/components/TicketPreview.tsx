import { useEffect, useRef, useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import { renderTicketCanvas, downloadTicketPng, downloadTicketPdf } from '../lib/ticketRenderer'
import { CATEGORIES } from '../lib/categories'
import type { Ticket } from '../lib/types'

export function TicketPreview({ ticket }: { ticket: Ticket }) {
  const [src, setSrc] = useState<string>('')
  const [busy, setBusy] = useState<'png' | 'pdf' | null>(null)
  const mounted = useRef(true)
  const cfg = CATEGORIES[ticket.category]

  useEffect(() => {
    mounted.current = true
    renderTicketCanvas(ticket)
      .then((c) => {
        if (mounted.current) setSrc(c.toDataURL('image/png'))
      })
      .catch((e) => console.error(e))
    return () => {
      mounted.current = false
    }
  }, [ticket.id, ticket.secret, ticket.category])

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="aspect-[2480/877] w-full bg-brand-cream/50">
        {src ? (
          <img src={src} alt={`Billet ${ticket.reference}`} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-brand-ink/40">
            <Loader2 className="animate-spin" />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-brand-ink">{ticket.holderName}</p>
          <p className="text-xs text-brand-ink/50">
            <span
              className="mr-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold"
              style={{ background: cfg.accent, color: cfg.accentText }}
            >
              {cfg.price}
            </span>
            {ticket.reference}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            className="btn-ghost px-2.5 py-1.5 text-xs"
            disabled={busy !== null}
            onClick={async () => {
              setBusy('png')
              try {
                await downloadTicketPng(ticket)
              } finally {
                setBusy(null)
              }
            }}
          >
            {busy === 'png' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} PNG
          </button>
          <button
            className="btn-gold px-2.5 py-1.5 text-xs"
            disabled={busy !== null}
            onClick={async () => {
              setBusy('pdf')
              try {
                await downloadTicketPdf(ticket)
              } finally {
                setBusy(null)
              }
            }}
          >
            {busy === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} PDF
          </button>
        </div>
      </div>
    </div>
  )
}
