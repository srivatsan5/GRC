// Source-based frontend deploy: Hostinger will run npm install + build + start.
const fs = require('fs')
const path = require('path')
const archiver = require('archiver')

const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(__dirname, 'datapulsefusion.com-frontend.zip')

try { fs.unlinkSync(OUT) } catch {}

const output = fs.createWriteStream(OUT)
const archive = archiver('zip', { zlib: { level: 9 } })

// Directories (recursive) shipped as-is.
const DIRS = ['app', 'components', 'lib', 'hooks', 'public', 'styles']

// Individual root-level files Next.js needs to build.
const FILES = [
  'package.json',
  'package-lock.json',
  'next.config.mjs',
  'tsconfig.json',
  'postcss.config.mjs',
  'tailwind.config.ts',
  'components.json',
  'next-env.d.ts',
]

let count = 0
archive.on('entry', () => { count++; if (count % 200 === 0) process.stdout.write(`\r${count} files...`) })
archive.on('warning', (err) => console.warn('warn:', err.code, err.message))
archive.on('error', (err) => { console.error('error:', err); process.exit(1) })
output.on('close', () => {
  const mb = (archive.pointer() / 1024 / 1024).toFixed(2)
  console.log(`\nDONE: ${OUT} — ${count} files, ${mb} MB`)
})

archive.pipe(output)

for (const d of DIRS) {
  const p = path.join(ROOT, d)
  if (fs.existsSync(p)) archive.directory(p, d)
}
for (const f of FILES) {
  const p = path.join(ROOT, f)
  if (fs.existsSync(p)) archive.file(p, { name: f })
}

// .env with the production API URL only — no secrets.
archive.append(
  'PORT=3000\nNEXT_PUBLIC_API_URL=https://api.datapulsefusion.com\n',
  { name: '.env' }
)

archive.append(readme(), { name: 'README.md' })

archive.finalize()

function readme() {
  return `# Pericope ERM Frontend — Hostinger Deployment (datapulsefusion.com)

This is a **Next.js 15 source build**. Hostinger will install deps, build, and start.

## Files in this zip

- \`app/\`, \`components/\`, \`lib/\`, \`hooks/\`, \`public/\`, \`styles/\` — source
- \`package.json\`, \`package-lock.json\`
- \`next.config.mjs\`, \`tsconfig.json\`, \`tailwind.config.ts\`, \`postcss.config.mjs\`, \`components.json\`, \`next-env.d.ts\`
- \`.env\` — \`NEXT_PUBLIC_API_URL=https://api.datapulsefusion.com\`

## Deploy steps on Hostinger

1. Open **hPanel → Websites → datapulsefusion.com → Node.js**.
2. Upload this zip and **Extract**.
3. Node.js app settings:
   - Application root: the extracted folder
   - **Startup file: \`node_modules/.bin/next\`** with args \`start\`
     - OR set "Application Startup Command" to \`npm start\`
   - Node version: \`18.x\` or higher (Next.js 15 requires Node 18.18+).
4. Click **Run NPM Install**.
5. Open SSH/Terminal in the app and run: \`npm run build\`
   - This produces the \`.next/\` folder Next.js needs to serve.
6. Click **Start App**.

## package.json scripts already present

\`\`\`json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
\`\`\`

## Verify

Visit https://datapulsefusion.com — app should load and fetch data from \`https://api.datapulsefusion.com\` (baked in at build time via \`NEXT_PUBLIC_API_URL\`).

## Environment variables

| Var | Default | Notes |
|-----|---------|-------|
| \`PORT\` | \`3000\` | Hostinger usually overrides this — that's fine |
| \`NEXT_PUBLIC_API_URL\` | \`https://api.datapulsefusion.com\` | Baked in at build time |

## Notes

- The backend (\`api.datapulsefusion.com\`) must be deployed and reachable for data to load.
- CORS is already enabled on the backend.
- If you change \`NEXT_PUBLIC_API_URL\` later, you must rerun \`npm run build\` for it to take effect (Next.js inlines public env vars at build time).
`
}
