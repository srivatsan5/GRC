const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const output = fs.createWriteStream(path.join(__dirname, 'backend-deployment.zip'));
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', function() {
  console.log('Backend Archive created successfully! Size: ' + (archive.pointer() / 1024 / 1024).toFixed(3) + ' MB');
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);

// Only include the backend files
if (fs.existsSync('server.js')) archive.file('server.js', { name: 'server.js' });
if (fs.existsSync('package.json')) archive.file('package.json', { name: 'package.json' });
if (fs.existsSync('package-lock.json')) archive.file('package-lock.json', { name: 'package-lock.json' });
if (fs.existsSync('.env')) archive.file('.env', { name: '.env' });

archive.finalize();
