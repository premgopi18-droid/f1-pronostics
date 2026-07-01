'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { UserAvatar } from '@/app/components/user-avatar'
import { Button } from '@/app/ui/button'
import { t, type TranslationKey } from '@/lib/i18n'
import {
  validateAvatarFile,
  pickAvatarOutputType,
  cropAvatarToBlob,
  buildAvatarObjectPath,
  AVATARS_BUCKET,
} from '@/lib/profile/avatar-image'

const PREVIEW_SIZE = 112 // px — aperçu de l'avatar dans l'éditeur

/**
 * Champ photo d'avatar, partagé entre l'onboarding (étape 2) et le profil.
 * Gère l'upload → crop carré interactif → compression → Storage, et remonte
 * l'URL publique résultante (ou null) au parent via `onAvatarUrlChange`.
 * La couleur du casque (`avatarKey`) pilote l'anneau de l'aperçu.
 */
export function AvatarPhotoField({
  userId,
  avatarKey,
  avatarUrl,
  onAvatarUrlChange,
}: {
  userId: string
  avatarKey: string | null
  avatarUrl: string | null
  onAvatarUrlChange: (url: string | null) => void
}) {
  const [supabase] = useState(createBrowserSupabaseClient)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const [error, setError] = useState<TranslationKey | null>(null)
  const [busy, setBusy] = useState(false)

  // État du recadrage (modale ouverte quand imageSrc != null)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [areaPixels, setAreaPixels] = useState<Area | null>(null)

  const onCropComplete = useCallback((_area: Area, areaPixelsValue: Area) => {
    setAreaPixels(areaPixelsValue)
  }, [])

  // Révoque l'objectURL source quand il change / au démontage (évite les fuites).
  useEffect(() => {
    return () => {
      if (imageSrc) URL.revokeObjectURL(imageSrc)
    }
  }, [imageSrc])

  // A11y modale : focus initial déplacé dans la modale (le conteneur, focusable via
  // tabIndex=-1 — « Valider » est désactivé tant que le crop n'est pas prêt) + fermeture
  // au clavier (Escape) écoutée au niveau document (une <div> ne reçoit pas la touche sinon).
  useEffect(() => {
    if (!imageSrc) return
    dialogRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) setImageSrc(null) // ferme (objectURL révoqué par l'effet dédié)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [imageSrc, busy])

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    const file = event.target.files?.[0]
    event.target.value = '' // autorise re-sélection du même fichier
    if (!file) return
    const validationError = validateAvatarFile(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setAreaPixels(null)
    setImageSrc(URL.createObjectURL(file))
  }

  function closeCropper() {
    setImageSrc(null) // l'objectURL est révoqué par l'effet de nettoyage
  }

  async function confirmCrop() {
    if (!imageSrc || !areaPixels) return
    setBusy(true)
    setError(null)
    try {
      const type = pickAvatarOutputType()
      const blob = await cropAvatarToBlob(imageSrc, areaPixels, type)
      const path = buildAvatarObjectPath(userId, type, crypto.randomUUID())

      const { error: uploadError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, blob, { contentType: type, upsert: false })
      if (uploadError) throw uploadError

      // On remonte juste la nouvelle URL. L'ancien fichier n'est PAS supprimé ici :
      // tant que le formulaire n'est pas enregistré, la DB pointe encore dessus.
      // La suppression de l'ancien fichier se fait côté action serveur, au save.
      const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path)
      onAvatarUrlChange(data.publicUrl)
      closeCropper()
    } catch {
      setError('avatar.photo.errorUpload')
    } finally {
      setBusy(false)
    }
  }

  function removePhoto() {
    // On repasse au casque dans l'UI ; l'ancien fichier sera supprimé au save
    // (action serveur), quand la DB ne le référencera plus.
    setError(null)
    onAvatarUrlChange(null)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <UserAvatar
        avatarKey={avatarKey}
        avatarUrl={avatarUrl}
        size={PREVIEW_SIZE}
        label={t('avatar.photoAlt')}
      />

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
          {avatarUrl ? t('avatar.photo.change') : t('avatar.photo.add')}
        </Button>
        {avatarUrl && (
          <Button variant="ghost" size="sm" onClick={removePhoto}>
            {t('avatar.photo.remove')}
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {t(error)}
        </p>
      )}

      {imageSrc && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('avatar.photo.cropTitle')}
          tabIndex={-1}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 outline-none"
        >
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-card p-5">
            <h3 className="text-base font-semibold text-foreground">
              {t('avatar.photo.cropTitle')}
            </h3>

            <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                objectFit="cover"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <label className="flex items-center gap-3 text-sm text-text-secondary">
              <span aria-hidden>🔍</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                aria-label={t('avatar.photo.zoomLabel')}
                className="flex-1 accent-primary"
              />
            </label>

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="flex-1" onClick={closeCropper} disabled={busy}>
                {t('avatar.photo.cropCancel')}
              </Button>
              <Button variant="accent" size="sm" className="flex-1" onClick={confirmCrop} disabled={busy || !areaPixels}>
                {busy ? t('profile.saving') : t('avatar.photo.cropConfirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
