import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-cream p-6 text-center">
      <p className="font-display text-7xl text-brand-red">404</p>
      <p className="mt-2 text-brand-ink/70">Cette page n'existe pas.</p>
      <Link to="/" className="btn-primary mt-6">
        Retour à l'accueil
      </Link>
    </div>
  )
}
