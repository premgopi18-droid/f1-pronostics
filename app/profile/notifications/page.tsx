import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase'
import { NotificationsContent } from './notifications-content'
import type { ImminenceScope } from '@/app/actions/notification-preferences'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const userId   = (await headers()).get('x-user-id')!

  const { data: profile } = await supabase
    .from('profiles')
    .select('notif_imminence_scope, notif_announcements')
    .eq('id', userId)
    .single()

  const imminenceScope = (profile?.notif_imminence_scope as ImminenceScope | null) ?? 'stakes-only'
  // Défaut true : aligné sur la colonne DB et sur « toutes activées par défaut ».
  const announcementsOptIn = (profile?.notif_announcements as boolean | null) ?? true

  return (
    <NotificationsContent
      defaultImminenceScope={imminenceScope}
      defaultAnnouncementsOptIn={announcementsOptIn}
    />
  )
}
