import type { CategoryId } from './types'

export interface CategoryConfig {
  id: CategoryId
  /** Libellé d'accès imprimé sur le billet. */
  label: string
  /** Prix affiché. */
  price: string
  /** Chemin du modèle PNG (dans /public). */
  template: string
  /** Dimensions natives du modèle. */
  width: number
  height: number
  /**
   * Emplacement réservé au QR ("VERIFICATION ACCÈS"), mesuré sur le modèle 2480x877.
   * cx/cy = centre du cadre, size = côté du QR (px).
   */
  qr: { cx: number; cy: number; size: number }
  /** Couleurs d'accent (pour l'UI). */
  accent: string
  accentText: string
  /** Synonymes acceptés dans la colonne "categorie" du CSV. */
  aliases: string[]
}

export const CATEGORIES: Record<CategoryId, CategoryConfig> = {
  PRESTIGE_VVP: {
    id: 'PRESTIGE_VVP',
    label: 'ACCÈS SOLIDAIRE PRESTIGE VVP',
    price: '100 $',
    template: '/templates/billet-100.png',
    width: 2480,
    height: 877,
    qr: { cx: 2307, cy: 675, size: 196 },
    accent: '#B11116',
    accentText: '#ffffff',
    aliases: ['100', '100$', '100 $', 'prestige', 'prestige vvp', 'vvp', 'prestige_vvp'],
  },
  VP: {
    id: 'VP',
    label: 'ACCÈS SOLIDAIRE VP',
    price: '50 $',
    template: '/templates/billet-50.png',
    width: 2480,
    height: 877,
    qr: { cx: 2307, cy: 675, size: 196 },
    accent: '#E2A507',
    accentText: '#7E0C10',
    aliases: ['50', '50$', '50 $', 'vp', 'solidaire vp'],
  },
  SOLIDAIRE: {
    id: 'SOLIDAIRE',
    label: 'ACCÈS SOLIDAIRE',
    price: '15000 FC',
    template: '/templates/billet-15000.png',
    width: 2480,
    height: 877,
    qr: { cx: 2307, cy: 675, size: 196 },
    accent: '#C9A86A',
    accentText: '#7E0C10',
    aliases: ['15000', '15000fc', '15000 fc', '15 000', 'solidaire', 'fc'],
  },
}

export const CATEGORY_LIST = Object.values(CATEGORIES)

/** Normalise une valeur de catégorie issue du CSV vers un CategoryId, sinon null. */
export function resolveCategory(raw: string): CategoryId | null {
  const v = (raw || '').trim().toLowerCase()
  if (!v) return null
  for (const cat of CATEGORY_LIST) {
    if (cat.id.toLowerCase() === v) return cat.id
    if (cat.aliases.includes(v)) return cat.id
  }
  return null
}
