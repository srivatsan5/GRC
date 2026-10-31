const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const output = fs.createWriteStream(path.join(process.cwd(), 'frontend-deployment.zip'));
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => console.log('Frontend ZIP created. Total bytes: ' + archive.pointer()));
archive.on('error', (err) => { throw err; });
archive.pipe(output);

// Include essential production files
if (fs.existsSync('.next')) {
    // Specifically ignore the .next/cache folder because it contains hundreds of MB of local build traces
    archive.glob('**/*', { 
        cwd: '.next', 
        ignore: ['cache/**'] 
    }, { prefix: '.next' });
}
if (fs.existsSync('public')) archive.directory('public/', 'public');
if (fs.existsSync('package.json')) archive.file('package.json', { name: 'package.json' });
if (fs.existsSync('package-lock.json')) archive.file('package-lock.json', { name: 'package-lock.json' });
if (fs.existsSync('next.config.mjs')) archive.file('next.config.mjs', { name: 'next.config.mjs' });
if (fs.existsSync('.env')) archive.file('.env', { name: '.env' });

archive.finalize();
