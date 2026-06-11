import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'
import { CameraOff, SwitchCamera } from 'lucide-react'

interface Props {
  /** Appelé à chaque décodage réussi. Le scanner se met en pause ensuite. */
  onResult: (text: string) => void
  /** Quand true, le scanner reprend la lecture. */
  active: boolean
}

const REGION_ID = 'qr-reader-region'

export function QrScanner({ onResult, active }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastDecodeRef = useRef<{ text: string; at: number }>({ text: '', at: 0 })
  const [error, setError] = useState('')
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([])
  const [camIndex, setCamIndex] = useState(0)
  const [started, setStarted] = useState(false)

  // Initialisation : liste des caméras + démarrage.
  useEffect(() => {
    let cancelled = false
    const scanner = new Html5Qrcode(REGION_ID, { verbose: false })
    scannerRef.current = scanner

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (cancelled) return
        if (!devices || devices.length === 0) {
          setError("Aucune caméra détectée sur cet appareil.")
          return
        }
        setCameras(devices.map((d) => ({ id: d.id, label: d.label })))
      })
      .catch(() => {
        if (!cancelled) setError("Accès caméra refusé. Autorisez la caméra puis rechargez la page.")
      })

    return () => {
      cancelled = true
      const s = scannerRef.current
      if (s && s.getState() === Html5QrcodeScannerState.SCANNING) {
        s.stop().then(() => s.clear()).catch(() => {})
      }
    }
  }, [])

  // Démarre la caméra sélectionnée.
  useEffect(() => {
    const scanner = scannerRef.current
    if (!scanner || cameras.length === 0) return
    const camId = cameras[camIndex]?.id
    if (!camId) return

    let cancelled = false
    const startScan = async () => {
      try {
        if (scanner.getState() === Html5QrcodeScannerState.SCANNING) {
          await scanner.stop()
        }
        await scanner.start(
          camId,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            const now = Date.now()
            // Anti-rebond : ignore le même code dans les 1,5 s.
            if (
              lastDecodeRef.current.text === decodedText &&
              now - lastDecodeRef.current.at < 1500
            ) {
              return
            }
            lastDecodeRef.current = { text: decodedText, at: now }
            onResult(decodedText)
          },
          () => {},
        )
        if (!cancelled) setStarted(true)
      } catch {
        if (!cancelled) setError("Impossible de démarrer la caméra.")
      }
    }
    startScan()

    return () => {
      cancelled = true
    }
  }, [cameras, camIndex])

  // Pause / reprise selon `active`.
  useEffect(() => {
    const scanner = scannerRef.current
    if (!scanner || !started) return
    try {
      if (active) {
        if (scanner.getState() === Html5QrcodeScannerState.PAUSED) scanner.resume()
      } else {
        if (scanner.getState() === Html5QrcodeScannerState.SCANNING) scanner.pause(true)
      }
    } catch {
      /* ignore */
    }
  }, [active, started])

  if (error) {
    return (
      <div className="flex aspect-square w-full flex-col items-center justify-center rounded-2xl bg-brand-ink/90 p-6 text-center text-white">
        <CameraOff className="mb-3 text-brand-gold" />
        <p className="text-sm">{error}</p>
        <p className="mt-2 text-xs text-white/60">
          Utilisez la saisie manuelle ci-dessous en attendant.
        </p>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <div id={REGION_ID} className="w-full [&_video]:!w-full [&_video]:!rounded-2xl" />
      {/* Cadre de visée stylisé */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="h-2/3 w-2/3 rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      </div>
      {cameras.length > 1 && (
        <button
          className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70"
          onClick={() => setCamIndex((i) => (i + 1) % cameras.length)}
          title="Changer de caméra"
        >
          <SwitchCamera size={18} />
        </button>
      )}
    </div>
  )
}
