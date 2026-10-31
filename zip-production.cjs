const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Helper to create a zip
function zipDirectory(sourceDir, outPath, ignorePaths = [], addFiles = []) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`Created ZIP: ${outPath} (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`);
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    // Glob directory contents
    archive.glob('**/*', {
      cwd: sourceDir,
      ignore: ignorePaths
    });

    // Add extra files manually
    addFiles.forEach(file => {
      if (fs.existsSync(file.src)) {
        if (fs.lstatSync(file.src).isDirectory()) {
          archive.directory(file.src, file.dest);
        } else {
          archive.file(file.src, { name: file.dest });
        }
      }
    });

    archive.finalize();
  });
}

async function run() {
  try {
    console.log('Generating Hostinger Deployment Packages...');

    // 1. Backend ZIP
    console.log('Packaging Backend...');
    await zipDirectory(
      path.join(process.cwd(), 'production', 'backend'),
      path.join(process.cwd(), 'hostinger-backend-deployment.zip')
    );

    // Copy to production folder as well for sync
    fs.copyFileSync(
      path.join(process.cwd(), 'hostinger-backend-deployment.zip'),
      path.join(process.cwd(), 'production', 'backend.zip')
    );

    // 2. Frontend Standalone ZIP
    console.log('Packaging Frontend Standalone...');
    // Standalone requires:
    // - contents of .next/standalone
    // - public/ folder copied to public/
    // - .next/static/ folder copied to .next/static/
    // Let's create a temporary archive that bundles these
    const standaloneDir = path.join(process.cwd(), '.next', 'standalone');
    if (!fs.existsSync(standaloneDir)) {
      throw new Error('.next/standalone not found! Make sure you build with nextConfig.output = "standalone" first.');
    }

    const outputFs = fs.createWriteStream(path.join(process.cwd(), 'hostinger-frontend-deployment.zip'));
    const archiveFs = archiver('zip', { zlib: { level: 9 } });

    const fsPromise = new Promise((resolve, reject) => {
      outputFs.on('close', () => {
        console.log(`Created Frontend Standalone ZIP: hostinger-frontend-deployment.zip (${(archiveFs.pointer() / 1024 / 1024).toFixed(2)} MB)`);
        resolve();
      });
      archiveFs.on('error', (err) => reject(err));
    });

    archiveFs.pipe(outputFs);
    // Glob standalone directory contents directly to the root of the ZIP, ignoring the original package.json
    archiveFs.glob('**/*', { 
      cwd: standaloneDir,
      ignore: ['package.json']
    });

    // Inject a custom package.json with a no-op build script to bypass Hostinger's automatic build step
    const customPackageJson = {
      name: "grc-frontend",
      version: "0.1.0",
      private: true,
      scripts: {
        "build": "echo 'Build skipped: already compiled standalone'",
        "start": "node server.js"
      },
      dependencies: {
        "next": "^15.3.1",
        "react": "^19.2.4",
        "react-dom": "^19.2.4"
      }
    };
    archiveFs.append(JSON.stringify(customPackageJson, null, 2), { name: 'package.json' });

    // Add public directory to ZIP as public/
    if (fs.existsSync('public')) {
      archiveFs.directory('public/', 'public');
    }
    // Add .next/static to ZIP as .next/static
    if (fs.existsSync('.next/static')) {
      archiveFs.directory('.next/static/', '.next/static');
    }

    archiveFs.finalize();
    await fsPromise;

    // Copy to production folder as well for sync
    fs.copyFileSync(
      path.join(process.cwd(), 'hostinger-frontend-deployment.zip'),
      path.join(process.cwd(), 'production', 'frontend.zip')
    );

    // 3. Frontend Source ZIP
    console.log('Packaging Frontend Source...');
    const includeDirs = ['app', 'components', 'lib', 'public', 'styles', 'hooks'];
    const includeFiles = ['package.json', 'package-lock.json', 'next.config.mjs', 'tsconfig.json', 'tailwind.config.ts', 'postcss.config.mjs', 'components.json', '.env'];
    
    const outputSrc = fs.createWriteStream(path.join(process.cwd(), 'hostinger-frontend-source-deployment.zip'));
    const archiveSrc = archiver('zip', { zlib: { level: 9 } });

    const srcPromise = new Promise((resolve, reject) => {
      outputSrc.on('close', () => {
        console.log(`Created Frontend Source ZIP: hostinger-frontend-source-deployment.zip (${(archiveSrc.pointer() / 1024 / 1024).toFixed(2)} MB)`);
        resolve();
      });
      archiveSrc.on('error', (err) => reject(err));
    });

    archiveSrc.pipe(outputSrc);
    
    includeDirs.forEach(dir => {
      if (fs.existsSync(dir)) archiveSrc.directory(dir + '/', dir);
    });
    
    includeFiles.forEach(file => {
      if (fs.existsSync(file)) archiveSrc.file(file, { name: file });
    });

    archiveSrc.finalize();
    await srcPromise;

    console.log('All packages generated successfully!');
  } catch (err) {
    console.error('Packaging failed:', err);
    process.exit(1);
  }
}

run();
