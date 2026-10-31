const fs = require('fs')
const path = require('path')
const archiver = require('archiver')

const SRC = path.join(__dirname, 'frontend')
const OUT = path.join(__dirname, 'datapulsefusion.com-frontend.zip')

try { fs.unlinkSync(OUT) } catch {}

const output = fs.createWriteStream(OUT)
const archive = archiver('zip', { zlib: { level: 9 } })

let count = 0
archive.on('entry', () => { count++; if (count % 500 === 0) process.stdout.write(`\r${count} files...`) })
archive.on('warning', (err) => { console.warn('warn:', err.code, err.message) })
archive.on('error', (err) => { console.error('error:', err); process.exit(1) })
output.on('close', () => {
  const mb = (archive.pointer() / 1024 / 1024).toFixed(2)
  console.log(`\nDONE: ${OUT} — ${count} files, ${mb} MB`)
})

archive.pipe(output)
archive.directory(SRC, false)
archive.finalize()
