import Link from 'next/link'
import { ChevronLeft, Megaphone } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { t } from '@/lib/i18n'

// Page « Nouveautés » : liste les annonces produit déjà diffusées. Alimentée par la table
// `announcements` via le client cookie/RLS → la policy `announcements_select_sent` ne rend
// visibles que les annonces envoyées (sent_at non null). Rattrape ceux qui n'ont pas reçu
// le push (iOS non installé, opt-out, appareil hors ligne).

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

export default async function WhatsNewPage() {
  const supabase = await createClient()

  const { data: announcements } = await supabase
    .from('announcements')
    .select('id, title, body, url, sent_at')
    .not('sent_at', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(50)

  const rows = announcements ?? []

  return (
    <main className="flex flex-1 flex-col px-page pt-2 pb-6">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <Link
          href="/profile"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t('whatsNew.back')}
        >
          <ChevronLeft size={20} aria-hidden />
        </Link>
        <h1 className="font-display text-xl font-bold text-foreground">
          {t('whatsNew.title')}
        </h1>
      </div>

      {rows.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Megaphone size={22} className="text-muted-foreground" aria-hidden />
          </span>
          <p className="text-sm text-muted-foreground">{t('whatsNew.empty')}</p>
        </div>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {rows.map((row) => {
            const target = (row.url as string | null) ?? '/whats-new'
            return (
              <li key={row.id as string}>
                <Link
                  href={target}
                  className="flex flex-col gap-1.5 rounded-2xl bg-card px-4 py-4 transition-colors hover:bg-muted/50 active:bg-muted"
                >
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {formatDate(row.sent_at as string)}
                  </span>
                  <span className="text-sm font-semibold text-foreground">{row.title as string}</span>
                  <span className="text-sm text-muted-foreground">{row.body as string}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
