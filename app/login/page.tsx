import { signInWithGoogle } from '@/app/actions/auth'
import { Button } from '@/app/ui/button'
import { t } from '@/lib/i18n'

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
        <Button type="submit" variant="light" size="block">
          <GoogleIcon />
          {t('login.cta')}
        </Button>
      </form>

      <p className="relative mt-5 text-xs text-text-muted">{t('login.footer')}</p>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.233 17.64 11.926 17.64 9.2z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  )
}
