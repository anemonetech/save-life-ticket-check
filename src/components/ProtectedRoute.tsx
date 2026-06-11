import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { FullScreenLoader } from './Spinner'
import type { Role } from '../lib/types'

interface Props {
  children: ReactNode
  /** Rôles autorisés. 'admin' a toujours accès. */
  allow: Role[]
}

export function ProtectedRoute({ children, allow }: Props) {
  const { user, role, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (role === 'pending' || role === null)
    return <Navigate to="/en-attente" replace />

  const allowed = role === 'admin' || allow.includes(role)
  if (!allowed) return <Navigate to="/" replace />

  return <>{children}</>
}
