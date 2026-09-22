import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { buttonVariants } from '@/app/ui/button'
import { t } from '@/lib/i18n'

/** Taille de l'icône d'état (badge carré 56px). */
const STATUS_ICON_SIZE = 26

// Page 404 dans la charte (#241) — déclenchée par `notFound()` (GP, ligue ou profil
// inconnus) et par toute URL sans route. La bottom nav reste affichée : l'utilisateur
// peut repartir d'un onglet sans passer par le bouton.
export default function NotFoundPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-page py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <SearchX size={STATUS_ICON_SIZE} className="text-muted-foreground" aria-hidden />
      </span>
      <h1 className="font-display text-2xl font-bold text-foreground">{t('notFoundPage.title')}</h1>
      <p className="max-w-xs text-sm text-text-secondary">{t('notFoundPage.text')}</p>
      <Link href="/" className={`${buttonVariants({ variant: 'secondary', size: 'block' })} mt-2 max-w-xs`}>
        {t('notFoundPage.home')}
      </Link>
    </main>
  )
}
