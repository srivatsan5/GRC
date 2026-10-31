const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const output = fs.createWriteStream(path.join(__dirname, 'hostinger-deployment.zip'));
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', function() {
  console.log('Archive created! Size: ' + (archive.pointer() / 1024 / 1024).toFixed(2) + ' MB');
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);

// Select exactly what goes to the server
archive.glob('**/*', {
  cwd: __dirname,
  ignore: [
    'node_modules/**', 
    '.git/**', 
    '.github/**',
    '.next/cache/**', 
    'hostinger-deployment.zip',
    'create-zip.cjs',
    '*.log',
    'tmp/**',
    'verify*.cjs',
    '*.bat',
    '*.sh',
    'README*.md',
    '.env.local'
  ]
});

archive.finalize();
