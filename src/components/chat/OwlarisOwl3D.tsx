'use client'

import { useEffect } from 'react'

interface Props {
  pose?: 'talking' | 'thinking' | 'waving' | 'celebrating'
  size?: number
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string
        'auto-rotate'?: boolean | string
        'rotation-per-second'?: string
        'shadow-intensity'?: string
        exposure?: string
        'tone-mapping'?: string
        'camera-controls'?: string | boolean
        'disable-zoom'?: boolean | string
        'interaction-prompt'?: string
      }, HTMLElement>
    }
  }
}

export default function OwlarisOwl3D({ pose = 'thinking', size = 280 }: Props) {
  useEffect(() => {
    if (!customElements.get('model-viewer')) {
      const script = document.createElement('script')
      script.type = 'module'
      script.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js'
      document.head.appendChild(script)
    }
  }, [])

  const modelMap = {
    talking:     '/models/owlaris-owl-talking.glb',
    thinking:    '/models/owlaris-owl-thinking.glb',
    waving:      '/models/owlaris-owl-waving.glb',
    celebrating: '/models/owlaris-owl-celebrating.glb',
  }

  return (
    <model-viewer
      src={modelMap[pose]}
      shadow-intensity="0"
      exposure="1.2"
      tone-mapping="aces"
      camera-controls
      interaction-prompt="none"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: 'transparent',
      } as React.CSSProperties}
    />
  )
}
