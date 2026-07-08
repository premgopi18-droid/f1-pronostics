import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { iconButtonVariants } from '@/app/ui/icon-button'
import { ChevronLeft } from 'lucide-react'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'
import { t } from '@/lib/i18n'
import { AdminClient } from './admin-client'

export type AdminMember = {
  userId: string
  isAdmin: boolean
  pseudo: string
  avatarKey: string | null
  avatarUrl: string | null
}

export default async function AdminPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const season = getCurrentSeason()
  const supabase = await createClient()
  const userId = (await headers()).get('x-user-id')!

  const [{ data: league }, { data: rawMembers }] = await Promise.all([
    supabase
      .from('leagues')
      .select('id, name, invite_code, invite_open')
      .eq('id', id)
      .single(),
    supabase
      .from('league_members')
      .select('user_id, is_admin, profiles!user_id(pseudo, avatar_key, avatar_url)')
      .eq('league_id', id)
      .eq('season', season),
  ])

  if (!league) notFound()

  const isAdmin = (rawMembers ?? []).some(
    (m) => m.user_id === userId && m.is_admin,
  )
  if (!isAdmin) redirect(`/leagues/${id}`)

  const members: AdminMember[] = (rawMembers ?? []).map((m) => {
    const profile = m.profiles
    return {
      userId: m.user_id,
      isAdmin: m.is_admin,
      pseudo: profile?.pseudo ?? '?',
      avatarKey: profile?.avatar_key ?? null,
      avatarUrl: profile?.avatar_url ?? null,
    }
  })

  return (
    <main className="flex flex-1 flex-col px-page pt-2 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 py-2">
        <Link
          href={`/leagues/${id}`}
          className={iconButtonVariants()}
          aria-label={t('common.back')}
        >
          <ChevronLeft size={20} aria-hidden />
        </Link>
        <h1 className="font-display text-xl font-bold text-foreground">
          {t('admin.pageTitle')}
        </h1>
      </div>

      <AdminClient
        leagueId={id}
        inviteCode={league.invite_code}
        inviteOpen={league.invite_open}
        members={members}
        currentUserId={userId}
      />
    </main>
  )
}
