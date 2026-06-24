import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'BoxBox',
    short_name:       'BoxBox',
    description:      'Pronostics F1 entre amis',
    start_url:        '/',
    display:          'standalone',
    background_color: '#0f0f0f',
    theme_color:      '#e8002d',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}