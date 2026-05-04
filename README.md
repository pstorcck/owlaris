# 🦉 Owlaris — Tutor IA Académico

## Instalación paso a paso

### Paso 1 — Clonar y preparar el proyecto
```bash
cd ~/proyectos
git clone https://github.com/pstorcck/owlaris.git
cd owlaris
npm install
```

### Paso 2 — Crear archivo de variables de entorno
```bash
cp .env.example .env.local
```
Luego abre `.env.local` y llena las claves de Supabase y OpenAI.

### Paso 3 — Ejecutar en local
```bash
npm run dev
```
Abre http://localhost:3000

### Paso 4 — Crear las tablas en Supabase
Ve a Supabase → SQL Editor → pega el contenido de `supabase-setup.sql` → Run

### Paso 5 — Deploy en Vercel
```bash
npx vercel --prod
```

## Variables de entorno requeridas
Ver `.env.example`

## Stack
- Next.js 14 + TypeScript
- Tailwind CSS
- Supabase (Auth + PostgreSQL)
- OpenAI API (GPT-4o-mini)
- Microsoft SharePoint via Graph API
- Vercel (deploy)
