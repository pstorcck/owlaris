'use client'

import { useEffect } from 'react'

// Reutiliza la declaración global de <model-viewer> ya hecha en
// OwlarisOwl3D.tsx (chat de voz) — TypeScript la aplica a todo el
// programa, no hace falta repetirla.

interface Props {
  size?: number
  progressBarColor?: string
}

// El script y los decodificadores Draco se sirven localmente (public/vendor)
// en vez de desde unpkg/gstatic: el login es la primera impresión de la app
// y no debe depender de que un CDN externo esté disponible en ese momento.
export default function OwlarisOwlHero({ size = 260, progressBarColor = '#7C3AED' }: Props) {
  useEffect(() => {
    if (customElements.get('model-viewer')) {
      const ModelViewerElement = customElements.get('model-viewer') as unknown as { dracoDecoderLocation: string }
      ModelViewerElement.dracoDecoderLocation = '/vendor/draco/'
      return
    }
    const script = document.createElement('script')
    script.type = 'module'
    script.src = '/vendor/model-viewer.min.js'
    document.head.appendChild(script)
    customElements.whenDefined('model-viewer').then(() => {
      const ModelViewerElement = customElements.get('model-viewer') as unknown as { dracoDecoderLocation: string }
      ModelViewerElement.dracoDecoderLocation = '/vendor/draco/'
    })
  }, [])

  return (
    <model-viewer
      src="/models/owlaris-owl-waving.glb"
      poster="/buho.png"
      loading="eager"
      reveal="auto"
      autoplay
      shadow-intensity="0"
      exposure="1.2"
      tone-mapping="aces"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        maxWidth: '100%',
        maxHeight: '100%',
        background: 'transparent',
        '--progress-bar-color': progressBarColor,
      } as React.CSSProperties}
    />
  )
}
