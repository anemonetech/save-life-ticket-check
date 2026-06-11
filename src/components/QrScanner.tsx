import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'
import { CameraOff, Flashlight, SwitchCamera } from 'lucide-react'

type CameraInfo = { id: string; label: string }
type ScannerConstraintSet = MediaTrackConstraintSet & {
  exposureMode?: string
  focusMode?: string
  torch?: boolean
  whiteBalanceMode?: string
}
type ScannerConstraints = MediaTrackConstraints & {
  advanced?: ScannerConstraintSet[]
}
type ScannerCapabilities = MediaTrackCapabilities & {
  exposureMode?: string[]
  focusMode?: string[]
  torch?: boolean
  whiteBalanceMode?: string[]
}

const BACK_CAMERA_PATTERN =
  /back|rear|environment|arriere|arrière|dos|traseira|trasera|camera 0|camera2/i

function preferredCameraIndex(cameras: CameraInfo[]) {
  const labelledBack = cameras.findIndex((camera) =>
    BACK_CAMERA_PATTERN.test(camera.label),
  )
  if (labelledBack >= 0) return labelledBack
  return cameras.length > 1 ? cameras.length - 1 : 0
}

function makeVideoConstraints(camId: string, fullscreen: boolean) {
  return {
    deviceId: { exact: camId },
    facingMode: { ideal: 'environment' },
    width: { ideal: fullscreen ? 1920 : 1280 },
    height: { ideal: fullscreen ? 1080 : 720 },
    frameRate: { ideal: fullscreen ? 30 : 24, min: 15 },
    advanced: [
      { focusMode: 'continuous' },
      { exposureMode: 'continuous' },
      { whiteBalanceMode: 'continuous' },
    ],
  } as ScannerConstraints
}

function makeQrBox(
  viewfinderWidth: number,
  viewfinderHeight: number,
  fullscreen: boolean,
) {
  const minEdge = Math.max(120, Math.min(viewfinderWidth, viewfinderHeight))
  const target = fullscreen ? 0.62 : 0.58
  const maxSize = fullscreen ? 430 : 320
  const maxAllowed = Math.max(120, minEdge - 24)
  const size = Math.floor(Math.min(minEdge * target, maxSize, maxAllowed))
  return { width: size, height: size }
}

function supportsMode(value: unknown, mode: string) {
  return Array.isArray(value) && value.includes(mode)
}

function torchSupported(scanner: Html5Qrcode) {
  try {
    return scanner.getRunningTrackCameraCapabilities().torchFeature().isSupported()
  } catch {
    try {
      return Boolean(
        (scanner.getRunningTrackCapabilities() as ScannerCapabilities).torch,
      )
    } catch {
      return false
    }
  }
}

async function tuneRunningCamera(scanner: Html5Qrcode, fullscreen: boolean) {
  try {
    const capabilities =
      scanner.getRunningTrackCapabilities() as ScannerCapabilities
    const advanced: ScannerConstraintSet[] = []
    if (supportsMode(capabilities.focusMode, 'continuous')) {
      advanced.push({ focusMode: 'continuous' })
    }
    if (supportsMode(capabilities.exposureMode, 'continuous')) {
      advanced.push({ exposureMode: 'continuous' })
    }
    if (supportsMode(capabilities.whiteBalanceMode, 'continuous')) {
      advanced.push({ whiteBalanceMode: 'continuous' })
    }
    if (advanced.length > 0) {
      await scanner.applyVideoConstraints({ advanced } as ScannerConstraints)
    }
  } catch {
    /* Certains navigateurs mobiles ignorent ces reglages. */
  }

  try {
    const zoom = scanner.getRunningTrackCameraCapabilities().zoomFeature()
    if (!zoom.isSupported()) return
    const min = zoom.min()
    const max = zoom.max()
    const current = zoom.value() ?? min
    const boost = fullscreen ? 0.18 : 0.1
    const target = Math.min(max, Math.max(current, min + (max - min) * boost))
    await zoom.apply(target)
  } catch {
    /* Zoom opt-in seulement quand la camera le permet. */
  }
}

interface Props {
  /** Appelé à chaque décodage réussi. Le scanner se met en pause ensuite. */
  onResult: (text: string) => void
  /** Quand true, le scanner reprend la lecture. */
  active: boolean
  /** Agrandit la zone vidéo et la mire pour le mode plein écran. */
  fullscreen?: boolean
  className?: string
}

export function QrScanner({
  onResult,
  active,
  fullscreen = false,
  className = '',
}: Props) {
  const reactId = useId()
  const regionId = useMemo(
    () => `qr-reader-region-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
    [reactId],
  )
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const onResultRef = useRef(onResult)
  const lastDecodeRef = useRef<{ text: string; at: number }>({
    text: '',
    at: 0,
  })
  const [error, setError] = useState('')
  const [cameras, setCameras] = useState<CameraInfo[]>([])
  const [camIndex, setCamIndex] = useState(0)
  const [started, setStarted] = useState(false)
  const [hasTorch, setHasTorch] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  // Initialisation : liste des caméras + démarrage.
  useEffect(() => {
    let cancelled = false
    const scanner = new Html5Qrcode(regionId, {
      verbose: false,
      useBarCodeDetectorIfSupported: true,
    })
    scannerRef.current = scanner

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (cancelled) return
        if (!devices || devices.length === 0) {
          setError('Aucune caméra détectée sur cet appareil.')
          return
        }
        const available = devices.map((d) => ({ id: d.id, label: d.label }))
        setCameras(available)
        setCamIndex((current) =>
          current > 0 && current < available.length
            ? current
            : preferredCameraIndex(available),
        )
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            'Accès caméra refusé. Autorisez la caméra puis rechargez la page.',
          )
        }
      })

    return () => {
      cancelled = true
      const s = scannerRef.current
      scannerRef.current = null
      if (!s) return
      const state = s.getState()
      if (
        state === Html5QrcodeScannerState.SCANNING ||
        state === Html5QrcodeScannerState.PAUSED
      ) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {})
      } else {
        try {
          s.clear()
        } catch {
          /* ignore */
        }
      }
    }
  }, [regionId])

  // Démarre la caméra sélectionnée.
  useEffect(() => {
    const scanner = scannerRef.current
    if (!scanner || cameras.length === 0) return
    const camId = cameras[camIndex]?.id
    if (!camId) return

    let cancelled = false
    const startScan = async () => {
      try {
        setError('')
        setStarted(false)
        setHasTorch(false)
        setTorchOn(false)
        const state = scanner.getState()
        if (
          state === Html5QrcodeScannerState.SCANNING ||
          state === Html5QrcodeScannerState.PAUSED
        ) {
          await scanner.stop()
        }
        await scanner.start(
          camId,
          {
            fps: fullscreen ? 24 : 16,
            disableFlip: true,
            videoConstraints: makeVideoConstraints(camId, fullscreen),
            qrbox: (viewfinderWidth, viewfinderHeight) =>
              makeQrBox(viewfinderWidth, viewfinderHeight, fullscreen),
          },
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
            onResultRef.current(decodedText)
          },
          () => {},
        )
        if (!cancelled) setStarted(true)
        await tuneRunningCamera(scanner, fullscreen)
        if (!cancelled) setHasTorch(torchSupported(scanner))
      } catch {
        if (!cancelled) setError('Impossible de démarrer la caméra.')
      }
    }
    startScan()

    return () => {
      cancelled = true
    }
  }, [cameras, camIndex, fullscreen])

  // Pause / reprise selon `active`.
  useEffect(() => {
    const scanner = scannerRef.current
    if (!scanner || !started) return
    try {
      if (active) {
        if (scanner.getState() === Html5QrcodeScannerState.PAUSED) {
          scanner.resume()
        }
      } else {
        if (scanner.getState() === Html5QrcodeScannerState.SCANNING) {
          scanner.pause(true)
        }
      }
    } catch {
      /* ignore */
    }
  }, [active, started])

  async function toggleTorch() {
    const scanner = scannerRef.current
    if (!scanner || !hasTorch) return
    const next = !torchOn
    try {
      await scanner.getRunningTrackCameraCapabilities().torchFeature().apply(next)
      setTorchOn(next)
    } catch {
      try {
        await scanner.applyVideoConstraints({
          advanced: [{ torch: next }],
        } as ScannerConstraints)
        setTorchOn(next)
      } catch {
        setHasTorch(false)
        setTorchOn(false)
      }
    }
  }

  if (error) {
    return (
      <div
        className={`flex w-full flex-col items-center justify-center bg-brand-ink/90 p-6 text-center text-white ${
          fullscreen ? 'h-full' : 'aspect-square rounded-2xl'
        } ${className}`}
      >
        <CameraOff className="mb-3 text-brand-gold" />
        <p className="text-sm">{error}</p>
        <p className="mt-2 text-xs text-white/60">
          Utilisez la saisie manuelle ci-dessous en attendant.
        </p>
      </div>
    )
  }

  return (
    <div
      className={`relative w-full max-w-full overflow-hidden bg-black ${
        fullscreen
          ? 'h-full min-h-0 rounded-none'
          : 'aspect-[3/4] max-h-[70vh] rounded-2xl sm:aspect-[4/3]'
      } ${className}`}
    >
      <div
        id={regionId}
        className="h-full w-full [&_canvas]:!h-full [&_canvas]:!w-full [&_div]:!max-w-full [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover"
      />
      {/* Cadre de visee : volontairement plus serre pour forcer un QR net. */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div
          className={`relative rounded-2xl border border-white/75 shadow-[0_0_0_9999px_rgba(0,0,0,0.32)] ${
            fullscreen
              ? 'h-[62vmin] max-h-[430px] w-[62vmin] max-w-[430px]'
              : 'h-[58%] max-h-[320px] w-[58%] max-w-[320px]'
          }`}
        >
          <span className="absolute -left-1 -top-1 h-10 w-10 border-l-4 border-t-4 border-white" />
          <span className="absolute -right-1 -top-1 h-10 w-10 border-r-4 border-t-4 border-white" />
          <span className="absolute -bottom-1 -left-1 h-10 w-10 border-b-4 border-l-4 border-white" />
          <span className="absolute -bottom-1 -right-1 h-10 w-10 border-b-4 border-r-4 border-white" />
        </div>
      </div>
      <div className="absolute right-3 top-3 flex items-center gap-2">
        {hasTorch && (
          <button
            className={`grid h-10 w-10 place-items-center rounded-full text-white backdrop-blur transition-colors ${
              torchOn ? 'bg-brand-gold text-brand-ink' : 'bg-black/55'
            }`}
            onClick={toggleTorch}
            title={torchOn ? 'Eteindre la lampe' : 'Allumer la lampe'}
          >
            <Flashlight size={18} />
          </button>
        )}
        {cameras.length > 1 && (
          <button
            className="grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75"
            onClick={() => setCamIndex((i) => (i + 1) % cameras.length)}
            title="Changer de caméra"
          >
            <SwitchCamera size={18} />
          </button>
        )}
      </div>
      {started && (
        <div className="pointer-events-none absolute inset-x-3 bottom-4 flex justify-center">
          <p className="max-w-[92%] rounded-full bg-black/60 px-3 py-1.5 text-center text-[11px] font-semibold text-white/90 backdrop-blur">
            Approchez le QR, centrez-le, gardez le billet stable.
          </p>
        </div>
      )}
    </div>
  )
}
