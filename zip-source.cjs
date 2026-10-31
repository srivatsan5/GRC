const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const output = fs.createWriteStream(path.join(process.cwd(), 'frontend-source-deployment.zip'));
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => console.log('Source ZIP created. Total bytes: ' + archive.pointer()));
archive.on('error', (err) => { throw err; });
archive.pipe(output);

// Include EVERYTHING needed for a server-side build
const includeDirs = ['app', 'components', 'lib', 'public', 'styles', 'hooks'];
const includeFiles = ['package.json', 'package-lock.json', 'next.config.mjs', 'tsconfig.json', 'tailwind.config.ts', 'postcss.config.mjs', 'components.json', '.env'];

includeDirs.forEach(dir => {
    if (fs.existsSync(dir)) archive.directory(dir + '/', dir);
});

includeFiles.forEach(file => {
    if (fs.existsSync(file)) archive.file(file, { name: file });
});

archive.finalize();
