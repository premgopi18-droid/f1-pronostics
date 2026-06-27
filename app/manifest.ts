import type { MetadataRoute } from 'next'
import { SPLASH_BACKGROUND_COLOR } from '@/lib/splash/splash'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'BoxBox',
    short_name:       'BoxBox',
    description:      'Pronostics F1 entre amis',
    start_url:        '/',
    display:          'standalone',
    // Partagé avec l'overlay du splash in-app : le splash système (icône sur ce
    // fond, rendu par l'OS) se fond ainsi sans cassure dans l'animation.
    background_color: SPLASH_BACKGROUND_COLOR,
    theme_color:      '#e8002d',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}