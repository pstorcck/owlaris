'use client'

import { useEffect } from 'react'

// Reutiliza la declaración global de <model-viewer> ya hecha en
// OwlarisOwl3D.tsx (chat de voz) — TypeScript la aplica a todo el
// programa, no hace falta repetirla.

interface Props {
  progressBarColor?: string
}

// El script y los decodificadores Draco se sirven localmente (public/vendor)
// en vez de desde unpkg/gstatic: el login es la primera impresión de la app
// y no debe depender de que un CDN externo esté disponible en ese momento.
//
// El tamaño lo controla siempre el contenedor (.ow-owl-3d-wrap en cada
// página), no un ancho/alto fijo aquí: <model-viewer> no respeta
// max-width/max-height cuando también se le da un width/height explícito
// en px (se queda con el valor fijo e ignora el tope), así que el único
// tamaño confiable es 100% relativo a un padre con dimensiones definidas.
export default function OwlarisOwlHero({ progressBarColor = '#7C3AED' }: Props) {
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
        display: 'block',
        width: '100%',
        height: '100%',
        background: 'transparent',
        '--progress-bar-color': progressBarColor,
      } as React.CSSProperties}
    />
  )
}
