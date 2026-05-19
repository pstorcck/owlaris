import { NextResponse } from 'next/server'

export async function GET() {
  const driveId      = process.env.SHAREPOINT_DRIVE_ID!
  const tenantId     = process.env.AZURE_TENANT_ID!
  const clientId     = process.env.AZURE_CLIENT_ID!
  const clientSecret = process.env.AZURE_CLIENT_SECRET!

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials',
      }),
    }
  )
  const { access_token: token } = await tokenRes.json()

  // Probar ruta exacta con segmentos codificados individualmente
  const segs = ['Owlaris', 'Escolaris', '3ero Básico', 'Mineduc - Lenguaje']
  const ruta = segs.map(s => encodeURIComponent(s)).join('/')
  const url  = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${ruta}:/children`

  const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const data = await res.json()

  return NextResponse.json({
    url_probada: ruta,
    status: res.status,
    archivos: (data.value || []).map((f: {name:string}) => f.name),
    error: data.error || null
  })
}
