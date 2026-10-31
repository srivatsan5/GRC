const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const output = fs.createWriteStream(path.join(process.cwd(), 'backend-deployment.zip'));
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => console.log('Backend ZIP created. Total bytes: ' + archive.pointer()));
archive.on('error', (err) => { throw err; });
archive.pipe(output);

// Include everything from the backend directory except node_modules
if (fs.existsSync('backend')) {
    archive.directory('backend/', false, (data) => {
        if (data.name.includes('node_modules')) return false;
        return data;
    });
} else {
    console.error('Backend directory not found!');
}

archive.finalize();
