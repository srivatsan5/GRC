const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const output = fs.createWriteStream(path.join(process.cwd(), 'production-backend-deployment.zip'));
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => console.log('Production Backend ZIP created. Total bytes: ' + archive.pointer()));
archive.on('error', (err) => { throw err; });
archive.pipe(output);

// Include contents of production/backend/ at the root of the ZIP
if (fs.existsSync('production/backend')) {
    archive.directory('production/backend/', false); // false means don't include the folder name itself
} else {
    console.error('Production Backend directory not found!');
}

archive.finalize();
