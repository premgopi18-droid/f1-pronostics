import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase'
import { t } from '@/lib/i18n'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { EditAvatarForm } from './edit-avatar-form'

export default async function EditAvatarPage() {
  const supabase = await createClient()
  const userId   = (await headers()).get('x-user-id')!

  const { data: profile } = await supabase
    .from('profiles')
    .select('pseudo, avatar_key')
    .eq('id', userId)
    .single()

  if (!profile) notFound()

  return (
    <main className="flex flex-1 flex-col px-page pt-2 pb-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-2">
        <Link
          href="/profile"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t('profile.back')}
        >
          <ChevronLeft size={20} aria-hidden />
        </Link>
        <h1 className="font-display text-xl font-bold text-foreground">
          {t('profile.editAvatarTitle')}
        </h1>
      </div>

      <EditAvatarForm
        pseudo={profile.pseudo as string}
        avatarKey={profile.avatar_key as string | null}
      />
    </main>
  )
}
