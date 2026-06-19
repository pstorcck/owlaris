'use client'

import { useState } from 'react'
import AsistenteDocente from '@/components/docente/AsistenteDocente'

interface Props {
  stats: unknown
  colegio: string
}

export default function BurbujaGuia({ stats, colegio }: Props) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button onClick={() => setAbierto(!abierto)}
        style={{position:'fixed',bottom:'28px',right:'28px',zIndex:100,display:'flex',alignItems:'center',gap:'10px',background:'linear-gradient(135deg,#2C3E6B,#1E3A5F)',color:'white',borderRadius:'20px',padding:'12px 20px',border:'none',cursor:'pointer',boxShadow:'0 8px 32px rgba(44,62,107,.4)',fontSize:'13px',fontWeight:600}}>
        <img src="/buho.png" alt="Owlaris" style={{width:'24px',height:'24px',objectFit:'contain'}}/>
        Guía Pedagógico
      </button>

      {abierto && (
        <div style={{position:'fixed',bottom:'90px',right:'28px',zIndex:99,width:'380px',maxHeight:'500px',background:'white',borderRadius:'16px',boxShadow:'0 20px 60px rgba(44,62,107,.2)',border:'1px solid rgba(44,62,107,.1)',overflow:'hidden',display:'flex',flexDirection:'column'}}>
          <div style={{background:'#2C3E6B',padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <img src="/buho.png" alt="" style={{width:'20px',height:'20px',objectFit:'contain'}}/>
              <span style={{color:'white',fontWeight:600,fontSize:'13px'}}>Guía Pedagógico</span>
            </div>
            <button onClick={() => setAbierto(false)} style={{background:'none',border:'none',color:'rgba(255,255,255,.7)',fontSize:'18px',cursor:'pointer',lineHeight:1}}>×</button>
          </div>
          <div style={{flex:1,overflow:'auto'}}>
            <AsistenteDocente stats={stats as Parameters<typeof AsistenteDocente>[0]['stats']} colegio={colegio}/>
          </div>
        </div>
      )}
    </>
  )
}
