const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, { encoding: 'utf8' }));
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 4) + '\n', { encoding: 'utf8' });
}

function parseSemver(version) {
  // Accepts formats like 1.2.3 or 1.2 or 1
  const parts = (version || '').split('.').map(p => parseInt(p, 10) || 0);
  return {
    Major: parts[0] || 0,
    Minor: parts[1] || 0,
    Patch: parts[2] || 0
  };
}

function main() {
  const root = path.resolve(__dirname, '..');
  const vssPath = path.resolve(root, 'vss-extension.json');
  const taskPath = path.resolve(root, 'src', 'task.json');
    const packagePath = path.resolve(root, 'package.json');

  if (!fs.existsSync(vssPath)) {
    console.error(`vss-extension.json not found at ${vssPath}`);
    process.exit(2);
  }

  if (!fs.existsSync(taskPath)) {
    console.error(`src/task.json not found at ${taskPath}`);
    process.exit(2);
  }

  const vss = readJson(vssPath);
  const task = readJson(taskPath);
  const pkg = fs.existsSync(packagePath) ? readJson(packagePath) : null;

  // Sync description
  if (typeof vss.description === 'string') {
    task.description = vss.description;
    console.log('Updated description from vss-extension.json');
  } else {
    console.warn('No description found in vss-extension.json, skipping description update');
  }

  // Sync version -> task.version { Major, Minor, Patch }
  if (typeof vss.version === 'string') {
    task.version = parseSemver(vss.version);
    console.log('Updated version from vss-extension.json ->', vss.version);
  } else if (typeof vss.version === 'object') {
    // If vss uses an object, try to map common fields
    task.version = {
      Major: vss.version.Major || 0,
      Minor: vss.version.Minor || 0,
      Patch: vss.version.Patch || 0
    };
    console.log('Updated version from vss-extension.json (object)');
  } else {
    console.warn('No version found in vss-extension.json, skipping version update');
  }

  writeJson(taskPath, task);
  console.log('Wrote updated src/task.json');

  // Sync package.json version if present
  if (pkg && typeof vss.version === 'string') {
    // write semver string to package.json.version
    pkg.version = vss.version;
    writeJson(packagePath, pkg);
    console.log('Updated package.json version ->', vss.version);
  } else if (pkg && typeof vss.version === 'object') {
    // try to reconstruct semver from object
    const ver = `${vss.version.Major || 0}.${vss.version.Minor || 0}.${vss.version.Patch || 0}`;
    pkg.version = ver;
    writeJson(packagePath, pkg);
    console.log('Updated package.json version ->', ver);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
}
