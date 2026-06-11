import { collection, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { AppUser, Role } from './types'

export async function listUsers(): Promise<AppUser[]> {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      uid: d.id,
      email: data.email || '',
      displayName: data.displayName || '',
      role: (data.role as Role) || 'pending',
      createdAt: data.createdAt,
    }
  })
}

export async function setUserRole(uid: string, role: Role): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { role })
}
