import { signInWithGoogle } from '@/app/actions/auth'
import { t } from '@/lib/i18n'
import { SubmitButton } from './submit-button'

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-8 text-center">
      {/* Glow rouge radial décoratif derrière le logo (animation désactivée si prefers-reduced-motion) */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-[58%] rounded-full [animation:bx-glow_4s_ease-in-out_infinite] motion-reduce:[animation:none]"
        style={{ background: 'radial-gradient(circle, var(--accent-soft), transparent 62%)' }}
      />

      <div className="relative">
        <h1 className="font-display text-[54px] font-black leading-none tracking-tight text-foreground">
          BOX<span className="text-primary">BOX</span>
        </h1>
        <p className="mx-auto mt-3.5 max-w-[240px] text-[15px] leading-relaxed text-text-secondary">
          {t('login.tagline1')}
          <br />
          {t('login.tagline2')}
        </p>
      </div>

      <form action={signInWithGoogle} className="relative mt-12 w-full max-w-[300px]">
        <SubmitButton />
      </form>

      <p className="relative mt-5 text-xs text-text-muted">{t('login.footer')}</p>
    </main>
  )
}

