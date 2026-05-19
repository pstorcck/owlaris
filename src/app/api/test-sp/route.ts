import { NextResponse } from 'next/server'

export async function GET() {
  const driveId = process.env.SHAREPOINT_DRIVE_ID
  const tenantId = process.env.AZURE_TENANT_ID
  const clientId = process.env.AZURE_CLIENT_ID
  const clientSecret = process.env.AZURE_CLIENT_SECRET

  // Verificar que las variables existen
  const vars = {
    driveId:      driveId ? driveId.substring(0, 20) + '...' : 'VACIO',
    tenantId:     tenantId ? tenantId.substring(0, 8) + '...' : 'VACIO',
    clientId:     clientId ? clientId.substring(0, 8) + '...' : 'VACIO',
    clientSecret: clientSecret ? 'EXISTE' : 'VACIO',
  }

  // Intentar obtener token
  try {
    const res = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     clientId!,
          client_secret: clientSecret!,
          scope:         'https://graph.microsoft.com/.default',
          grant_type:    'client_credentials',
        }),
      }
    )
    const data = await res.json()
    const token = data.access_token

    if (!token) return NextResponse.json({ vars, token: 'ERROR', tokenError: data })

    // Intentar listar Owlaris
    const resFiles = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/Owlaris:/children`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const dataFiles = await resFiles.json()
    const nombres = (dataFiles.value || []).map((f: {name:string}) => f.name)

    return NextResponse.json({ vars, token: 'OK', carpetas: nombres, error: dataFiles.error })
  } catch (e) {
    return NextResponse.json({ vars, error: String(e) })
  }
}
