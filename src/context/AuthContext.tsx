import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { AppUser, Role } from '../lib/types'

interface AuthContextValue {
  user: User | null
  appUser: AppUser | null
  loading: boolean
  role: Role | null
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => Promise<void>
  refreshAppUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadAppUser(u: User): Promise<AppUser> {
    const ref = doc(db, 'users', u.uid)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      // Premier accès : rôle "pending" tant qu'un admin n'a pas validé.
      const fresh: AppUser = {
        uid: u.uid,
        email: u.email || '',
        displayName: u.displayName || u.email?.split('@')[0] || 'Utilisateur',
        role: 'pending',
      }
      await setDoc(ref, {
        email: fresh.email,
        displayName: fresh.displayName,
        role: 'pending',
        createdAt: serverTimestamp(),
      })
      return fresh
    }
    const data = snap.data()
    return {
      uid: u.uid,
      email: data.email || u.email || '',
      displayName: data.displayName || u.displayName || '',
      role: (data.role as Role) || 'pending',
    }
  }

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        try {
          setAppUser(await loadAppUser(u))
        } catch (e) {
          console.error('Chargement du profil échoué', e)
          setAppUser(null)
        }
      } else {
        setAppUser(null)
      }
      setLoading(false)
    })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      appUser,
      loading,
      role: appUser?.role ?? null,
      async login(email, password) {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      },
      async signup(email, password, displayName) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
        if (displayName) await updateProfile(cred.user, { displayName })
        await loadAppUser(cred.user)
      },
      async logout() {
        await signOut(auth)
      },
      async refreshAppUser() {
        if (user) setAppUser(await loadAppUser(user))
      },
    }),
    [user, appUser, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
