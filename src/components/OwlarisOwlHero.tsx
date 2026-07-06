'use client'

import { useEffect, useRef } from 'react'

// Reutiliza la declaración global de <model-viewer> ya hecha en
// OwlarisOwl3D.tsx (chat de voz) — TypeScript la aplica a todo el
// programa, no hace falta repetirla.

interface Props {
  progressBarColor?: string
}

const MODEL_SRC = '/models/owlaris-owl-waving.glb'

// El script y los decodificadores Draco se sirven localmente (public/vendor)
// en vez de desde unpkg/gstatic: el login es la primera impresión de la app
// y no debe depender de que un CDN externo esté disponible en ese momento.
//
// El tamaño lo controla siempre el contenedor (.ow-owl-3d-wrap en cada
// página), no un ancho/alto fijo aquí: <model-viewer> no respeta
// max-width/max-height cuando también se le da un width/height explícito
// en px (se queda con el valor fijo e ignora el tope), así que el único
// tamaño confiable es 100% relativo a un padre con dimensiones definidas.
//
// El `src` NO se pone en el JSX: se asigna por código después de fijar
// dracoDecoderLocation, para evitar una carrera donde el modelo empiece a
// pedir el decodificador Draco por defecto (gstatic) antes de que la
// ubicación local esté configurada.
//
// owlaris-owl-waving.glb (igual que los otros 3 modelos del chat de voz)
// es una malla estática posada, sin ninguna animación real incluida
// (availableAnimations siempre vacío, confirmado inspeccionando el chunk
// JSON del .glb) — autoplay no tiene nada que reproducir. El movimiento
// visible viene de auto-rotate (gira la cámara lentamente) más un balanceo
// suave por CSS en el contenedor de la página.
export default function OwlarisOwlHero({ progressBarColor = '#7C3AED' }: Props) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    function configurarYCargar() {
      const ModelViewerElement = customElements.get('model-viewer') as unknown as { dracoDecoderLocation: string }
      ModelViewerElement.dracoDecoderLocation = '/vendor/draco/'
      if (ref.current) (ref.current as unknown as { src: string }).src = MODEL_SRC
    }
    if (customElements.get('model-viewer')) {
      configurarYCargar()
      return
    }
    const script = document.createElement('script')
    script.type = 'module'
    script.src = '/vendor/model-viewer.min.js'
    document.head.appendChild(script)
    customElements.whenDefined('model-viewer').then(configurarYCargar)
  }, [])

  return (
    <model-viewer
      ref={ref}
      poster="/buho.png"
      loading="eager"
      reveal="auto"
      camera-controls
      auto-rotate
      rotation-per-second="12deg"
      camera-orbit="5deg 78deg 105%"
      shadow-intensity="0"
      exposure="1.2"
      tone-mapping="aces"
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        background: 'transparent',
        pointerEvents: 'none',
        '--progress-bar-color': progressBarColor,
      } as React.CSSProperties}
    />
  )
}
