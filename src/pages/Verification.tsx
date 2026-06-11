import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  DoorOpen,
  KeyRound,
  Search,
  ScanLine,
  ShieldAlert,
  XCircle,
  Zap,
} from "lucide-react";
import { QrScanner } from "../components/QrScanner";
import { buildQrPayload, parseQrPayload } from "../lib/crypto";
import { scanTicket, type ScanResult } from "../lib/tickets";
import { CATEGORIES, CATEGORY_LIST } from "../lib/categories";
import { computeStats, subscribeTickets } from "../lib/stats";
import { useAuth } from "../context/AuthContext";
import type { Ticket } from "../lib/types";
import type { Timestamp } from "firebase/firestore";

interface DisplayResult extends ScanResult {
  at: number;
}

function fmt(ts?: Timestamp): string {
  if (!ts) return "—";
  try {
    return ts.toDate().toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "medium",
    });
  } catch {
    return "—";
  }
}

export default function VerificationPage() {
  const { appUser } = useAuth();
  const [scanActive, setScanActive] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<DisplayResult | null>(null);
  const [history, setHistory] = useState<DisplayResult[]>([]);
  const [manual, setManual] = useState("");
  const [autoMode, setAutoMode] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [searchRef, setSearchRef] = useState("");
  const [searchMsg, setSearchMsg] = useState("");
  const processingRef = useRef(false);

  // Stats globales temps réel (tous les billets de l'événement).
  useEffect(() => {
    const unsub = subscribeTickets(setTickets, () => {});
    return () => unsub();
  }, []);
  const live = useMemo(() => computeStats(tickets, []), [tickets]);

  const stats = {
    admitted: history.filter((h) => h.result === "admitted").length,
    refused: history.filter((h) => h.result !== "admitted").length,
  };

  // Mode auto : réarme le scanner automatiquement après affichage du résultat.
  useEffect(() => {
    if (!autoMode || !result) return;
    const delay = result.result === "admitted" ? 1800 : 3500;
    const t = setTimeout(() => next(), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, autoMode]);

  function searchByReference(e: React.FormEvent) {
    e.preventDefault();
    setSearchMsg("");
    const ref = searchRef.trim().toLowerCase();
    if (!ref) return;
    const found = tickets.find(
      (t) =>
        (t.reference || "").toLowerCase() === ref || t.id.toLowerCase() === ref,
    );
    if (!found) {
      setSearchMsg("Aucun billet trouvé pour cette référence.");
      return;
    }
    setSearchRef("");
    process(buildQrPayload(found.id, found.secret));
  }

  async function process(text: string) {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    setScanActive(false);
    try {
      const parsed = parseQrPayload(text);
      let res: ScanResult;
      if (!parsed) {
        res = { result: "invalid" };
      } else {
        res = await scanTicket(parsed.id, parsed.secret, {
          uid: appUser!.uid,
          email: appUser!.email,
        });
      }
      const display: DisplayResult = { ...res, at: Date.now() };
      setResult(display);
      setHistory((prev) => [display, ...prev].slice(0, 30));
      beep(res.result === "admitted");
    } catch (e) {
      console.error(e);
      setResult({ result: "invalid", at: Date.now() });
    } finally {
      setProcessing(false);
      processingRef.current = false;
    }
  }

  function next() {
    setResult(null);
    setScanActive(true);
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (manual.trim()) {
      process(manual.trim());
      setManual("");
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      {/* Colonne scanner */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white">
              <ScanLine size={20} />
            </span>
            <div>
              <h1 className="text-xl font-extrabold text-brand-ink">
                Vérification des accès
              </h1>
              <p className="text-sm text-brand-ink/60">
                Scannez le QR code du billet pour contrôler l'entrée.
              </p>
            </div>
          </div>
          <button
            onClick={() => setAutoMode((v) => !v)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
              autoMode
                ? "bg-emerald-600 text-white"
                : "bg-white text-brand-ink/60 ring-1 ring-black/10"
            }`}
            title="Réarme automatiquement le scanner après chaque billet"
          >
            <Zap size={14} /> Mode auto {autoMode ? "ON" : "OFF"}
          </button>
        </div>

        <div className="relative">
          <QrScanner onResult={process} active={scanActive && !result} />
          {result && <ResultOverlay result={result} onNext={next} />}
          {processing && !result && (
            <div className="absolute inset-0 grid place-items-center rounded-2xl bg-black/50 text-white">
              Vérification…
            </div>
          )}
        </div>

        {/* Saisie manuelle */}
        <form onSubmit={submitManual} className="card flex items-end gap-2">
          <div className="flex-1">
            <label className="label">Saisie manuelle (contenu du QR)</label>
            <div className="relative">
              <KeyRound
                size={16}
                className="pointer-events-none absolute left-3 top-3 text-brand-ink/40"
              />
              <input
                className="input pl-9"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="identifiant.jeton"
              />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={processing}>
            Vérifier
          </button>
        </form>

        {/* Recherche par référence (billet papier sans QR lisible) */}
        <form
          onSubmit={searchByReference}
          className="card flex items-end gap-2"
        >
          <div className="flex-1">
            <label className="label">Rechercher par référence</label>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-3 text-brand-ink/40"
              />
              <input
                className="input pl-9"
                value={searchRef}
                onChange={(e) => setSearchRef(e.target.value)}
                placeholder="Ex : SL-0001"
              />
            </div>
            {searchMsg && (
              <p className="mt-1 text-xs font-medium text-brand-red">
                {searchMsg}
              </p>
            )}
          </div>
          <button type="submit" className="btn-ghost" disabled={processing}>
            Valider
          </button>
        </form>
      </div>

      {/* Colonne stats + historique */}
      <div className="space-y-4">
        {/* Stats globales temps réel */}
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 font-semibold text-brand-ink">
              <DoorOpen size={18} className="text-emerald-600" /> Entrées (temps
              réel)
            </p>
            <span className="text-sm font-bold text-brand-ink">
              {live.used}/{live.total}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{
                width: `${live.total ? (live.used / live.total) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="mt-3 space-y-1.5">
            {CATEGORY_LIST.map((c) => {
              const s = live.byCategory[c.id];
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span
                    className="rounded px-1.5 py-0.5 font-bold"
                    style={{ background: c.accent, color: c.accentText }}
                  >
                    {c.price}
                  </span>
                  <span className="text-brand-ink/60">
                    <span className="font-semibold text-emerald-700">
                      {s.used}
                    </span>{" "}
                    / {s.total} entrés · {s.remaining} restants
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="card text-center">
            <p className="text-3xl font-extrabold text-emerald-600">
              {stats.admitted}
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-ink/50">
              Admis
            </p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-extrabold text-brand-red">
              {stats.refused}
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-ink/50">
              Refusés
            </p>
          </div>
        </div>

        <div className="card p-0">
          <p className="border-b border-black/5 px-4 py-3 font-semibold text-brand-ink">
            Historique de la session
          </p>
          <div className="max-h-[460px] divide-y divide-black/5 overflow-auto">
            {history.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-brand-ink/40">
                Aucun scan pour le moment.
              </p>
            )}
            {history.map((h, i) => (
              <HistoryRow key={i} item={h} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultOverlay({
  result,
  onNext,
}: {
  result: DisplayResult;
  onNext: () => void;
}) {
  const r = result.result;
  const ticket = result.ticket;
  const cfg = ticket ? CATEGORIES[ticket.category] : null;

  const theme =
    r === "admitted"
      ? { bg: "bg-emerald-600", Icon: CheckCircle2, title: "ACCÈS AUTORISÉ" }
      : r === "already_used"
        ? { bg: "bg-orange-500", Icon: ShieldAlert, title: "DÉJÀ UTILISÉ" }
        : r === "not_found"
          ? { bg: "bg-brand-red", Icon: XCircle, title: "BILLET INTROUVABLE" }
          : {
              bg: "bg-brand-redDark",
              Icon: AlertOctagon,
              title: "BILLET INVALIDE",
            };

  const Icon = theme.Icon;

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center rounded-2xl ${theme.bg} p-6 text-center text-white`}
    >
      <Icon size={56} className="mb-2" />
      <p className="font-display text-3xl tracking-wide">{theme.title}</p>

      {ticket && (
        <div className="mt-3 w-full max-w-xs rounded-xl bg-black/15 p-3 text-left text-sm">
          <p className="text-lg font-bold leading-tight">{ticket.holderName}</p>
          <p className="text-white/80">
            {cfg?.price} · {cfg?.label}
          </p>
          {ticket.reference && (
            <p className="text-white/70">Réf : {ticket.reference}</p>
          )}
          {ticket.seat && (
            <p className="text-white/70">Place : {ticket.seat}</p>
          )}
        </div>
      )}

      {r === "already_used" && (
        <div className="mt-3 w-full max-w-xs rounded-xl bg-black/25 p-3 text-left text-sm">
          <p className="flex items-center gap-1.5 font-semibold">
            <Clock size={14} /> Premier passage
          </p>
          <p className="text-white/80">{fmt(result.firstScanAt)}</p>
          <p className="text-white/80">
            Par : {result.firstScanByEmail || "inconnu"}
          </p>
          <p className="mt-1 text-white/70">
            Nombre de scans : {result.scanCount}
          </p>
        </div>
      )}

      <button
        onClick={onNext}
        className="mt-5 rounded-xl bg-white px-6 py-2.5 text-sm font-bold text-brand-ink shadow hover:bg-white/90"
      >
        Scanner le suivant
      </button>
    </div>
  );
}

function HistoryRow({ item }: { item: DisplayResult }) {
  const ticket = item.ticket;
  const r = item.result;
  const meta =
    r === "admitted"
      ? { cls: "text-emerald-600", Icon: CheckCircle2, label: "Admis" }
      : r === "already_used"
        ? { cls: "text-orange-500", Icon: ShieldAlert, label: "Déjà utilisé" }
        : {
            cls: "text-brand-red",
            Icon: XCircle,
            label: r === "not_found" ? "Introuvable" : "Invalide",
          };
  const Icon = meta.Icon;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Icon size={18} className={meta.cls} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-brand-ink">
          {ticket?.holderName || "Billet inconnu"}
        </p>
        <p className="text-xs text-brand-ink/50">
          {ticket?.reference ? `${ticket.reference} · ` : ""}
          {new Date(item.at).toLocaleTimeString("fr-FR")}
        </p>
      </div>
      <span className={`text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
    </div>
  );
}

let audioCtx: AudioContext | null = null;
function beep(ok: boolean) {
  try {
    audioCtx ||= new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    )();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.value = 0.08;
    osc.start();
    osc.stop(audioCtx.currentTime + (ok ? 0.12 : 0.3));
  } catch {
    /* ignore */
  }
}
