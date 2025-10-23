#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const workspaceConfigs = [
  { dir: 'apps/game-web' },
  { dir: 'apps/admin' },
];

const importers = {
  '.': {
    dependencies: {},
    devDependencies: {},
    optionalDependencies: {},
  },
};

const packagesRaw = new Map();
const nameToVersions = new Map();
const snapshotsRaw = new Map();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureSet(map, key) {
  if (!map.has(key)) {
    map.set(key, new Set());
  }
  return map.get(key);
}

function pathToName(lockPath) {
  const segments = lockPath.split('node_modules/');
  return segments[segments.length - 1];
}

function addPackageData(name, version, data) {
  const key = `${name}@${version}`;
  if (!packagesRaw.has(key)) {
    packagesRaw.set(key, {
      name,
      version,
      resolved: data.resolved,
      integrity: data.integrity,
      dependencies: data.dependencies ? { ...data.dependencies } : undefined,
      optionalDependencies: data.optionalDependencies ? { ...data.optionalDependencies } : undefined,
      peerDependencies: data.peerDependencies ? { ...data.peerDependencies } : undefined,
      peerDependenciesMeta: data.peerDependenciesMeta ? { ...data.peerDependenciesMeta } : undefined,
      engines: data.engines ? { ...data.engines } : undefined,
      cpu: data.cpu ? [...data.cpu] : undefined,
      os: data.os ? [...data.os] : undefined,
      bin: data.bin ? data.bin : undefined,
      hasInstallScript: Boolean(data.hasInstallScript),
      optional: Boolean(data.optional),
      funding: data.funding,
    });
  }
  ensureSet(nameToVersions, name).add(version);
}

function findPackageVersion(lockPackages, depName) {
  const target = `node_modules/${depName}`;
  for (const [pkgPath, data] of Object.entries(lockPackages)) {
    if (!pkgPath) continue;
    if (pkgPath.endsWith(target)) {
      return data.version;
    }
  }
  for (const [pkgPath, data] of Object.entries(lockPackages)) {
    if (!pkgPath) continue;
    const name = pathToName(pkgPath);
    if (name === depName) {
      return data.version;
    }
  }
  return undefined;
}

function mapDependencies(rawDeps) {
  if (!rawDeps) return undefined;
  const mapped = {};
  for (const depName of Object.keys(rawDeps)) {
    const versions = nameToVersions.get(depName);
    if (versions && versions.size > 0) {
      mapped[depName] = Array.from(versions)[0];
    }
  }
  return Object.keys(mapped).length ? mapped : undefined;
}

function toYaml(value, indent = 0) {
  const lines = [];
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      lines.push(`${pad}[]`);
      return lines;
    }
    for (const item of value) {
      if (item && typeof item === 'object') {
        const childLines = toYaml(item, indent + 2);
        const first = childLines.shift() || '';
        lines.push(`${pad}- ${first.trimStart()}`);
        for (const line of childLines) {
          lines.push(line);
        }
      } else {
        lines.push(`${pad}- ${formatScalar(item)}`);
      }
    }
    return lines;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined && !(typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0));
    if (entries.length === 0) {
      lines.push(`${pad}{}`);
      return lines;
    }
    for (const [key, val] of entries) {
      if (Array.isArray(val)) {
        if (val.length === 0) {
          lines.push(`${pad}${key}: []`);
        } else {
          lines.push(`${pad}${key}:`);
          lines.push(...toYaml(val, indent + 2));
        }
      } else if (val && typeof val === 'object') {
        const child = toYaml(val, indent + 2);
        if (child.length === 1 && child[0] === ' '.repeat(indent + 2) + '{}') {
          lines.push(`${pad}${key}: {}`);
        } else {
          lines.push(`${pad}${key}:`);
          lines.push(...child);
        }
      } else {
        lines.push(`${pad}${key}: ${formatScalar(val)}`);
      }
    }
    return lines;
  }
  lines.push(`${pad}${formatScalar(value)}`);
  return lines;
}

function formatScalar(value) {
  if (typeof value === 'string') {
    if (value === '') return "''";
    if (/[:#\-?\[\]{}!&*>|'"%@`\s]|^\d/.test(value) || value.includes('\n')) {
      return JSON.stringify(value);
    }
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

for (const workspace of workspaceConfigs) {
  const pkgPath = path.join(repoRoot, workspace.dir, 'package.json');
  const lockPath = path.join(repoRoot, workspace.dir, 'package-lock.json');
  if (!fs.existsSync(pkgPath) || !fs.existsSync(lockPath)) {
    continue;
  }
  const pkgJson = readJson(pkgPath);
  const lockJson = readJson(lockPath);
  const importer = {
    dependencies: {},
    devDependencies: {},
    optionalDependencies: {},
  };

  const deps = pkgJson.dependencies || {};
  for (const [depName, specifier] of Object.entries(deps)) {
    const resolvedVersion = findPackageVersion(lockJson.packages, depName) || specifier.replace(/^[^0-9]*/, '');
    importer.dependencies[depName] = {
      specifier,
      version: resolvedVersion,
    };
  }

  const optDeps = pkgJson.optionalDependencies || {};
  for (const [depName, specifier] of Object.entries(optDeps)) {
    const resolvedVersion = findPackageVersion(lockJson.packages, depName) || specifier.replace(/^[^0-9]*/, '');
    importer.optionalDependencies[depName] = {
      specifier,
      version: resolvedVersion,
    };
  }

  const devDeps = pkgJson.devDependencies || {};
  for (const [depName, specifier] of Object.entries(devDeps)) {
    const resolvedVersion = findPackageVersion(lockJson.packages, depName) || specifier.replace(/^[^0-9]*/, '');
    importer.devDependencies[depName] = {
      specifier,
      version: resolvedVersion,
    };
  }

  importers[workspace.dir] = importer;

  for (const [pkgPathKey, data] of Object.entries(lockJson.packages)) {
    if (!pkgPathKey) continue;
    const name = pathToName(pkgPathKey);
    if (!data.version) continue;
    addPackageData(name, data.version, data);
    const snapKey = `${name}@${data.version}`;
    if (!snapshotsRaw.has(snapKey)) {
      snapshotsRaw.set(snapKey, {
        dependencies: data.dependencies ? { ...data.dependencies } : undefined,
        optionalDependencies: data.optionalDependencies ? { ...data.optionalDependencies } : undefined,
      });
    }
  }
}

const packages = {};
const snapshots = {};

for (const [key, info] of packagesRaw.entries()) {
  const entry = {
    resolution: {
      integrity: info.integrity,
    },
  };
  if (info.resolved) {
    entry.resolution.tarball = info.resolved;
  }
  const deps = mapDependencies(info.dependencies);
  if (deps) entry.dependencies = deps;
  const optDeps = mapDependencies(info.optionalDependencies);
  if (optDeps) entry.optionalDependencies = optDeps;
  if (info.peerDependencies && Object.keys(info.peerDependencies).length) entry.peerDependencies = info.peerDependencies;
  if (info.peerDependenciesMeta && Object.keys(info.peerDependenciesMeta).length) entry.peerDependenciesMeta = info.peerDependenciesMeta;
  if (info.engines) entry.engines = info.engines;
  if (info.cpu) entry.cpu = info.cpu;
  if (info.os) entry.os = info.os;
  if (info.bin) entry.hasBin = true;
  if (info.hasInstallScript) entry.requiresBuild = true;
  if (info.optional) entry.optional = true;
  if (info.funding) entry.funding = info.funding;
  packages[key] = entry;

  const snapSource = snapshotsRaw.get(key) || {};
  const snap = {};
  const snapDeps = mapDependencies(snapSource.dependencies);
  if (snapDeps) snap.dependencies = snapDeps;
  const snapOptDeps = mapDependencies(snapSource.optionalDependencies);
  if (snapOptDeps) snap.optionalDependencies = snapOptDeps;
  if (Object.keys(snap).length > 0) {
    snapshots[key] = snap;
  }
}

const lockData = {
  lockfileVersion: '9.0',
  settings: {
    autoInstallPeers: true,
    excludeLinksFromLockfile: false,
  },
  importers: {},
  packages,
  snapshots,
};

for (const [importerName, data] of Object.entries(importers)) {
  const cleaned = {};
  if (data.dependencies && Object.keys(data.dependencies).length) {
    cleaned.dependencies = {};
    for (const [depName, info] of Object.entries(data.dependencies)) {
      cleaned.dependencies[depName] = {
        specifier: info.specifier,
        version: info.version,
      };
    }
  }
  if (data.devDependencies && Object.keys(data.devDependencies).length) {
    cleaned.devDependencies = {};
    for (const [depName, info] of Object.entries(data.devDependencies)) {
      cleaned.devDependencies[depName] = {
        specifier: info.specifier,
        version: info.version,
      };
    }
  }
  if (data.optionalDependencies && Object.keys(data.optionalDependencies).length) {
    cleaned.optionalDependencies = {};
    for (const [depName, info] of Object.entries(data.optionalDependencies)) {
      cleaned.optionalDependencies[depName] = {
        specifier: info.specifier,
        version: info.version,
      };
    }
  }
  lockData.importers[importerName] = cleaned;
}

function sortObject(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortObject(obj[key]);
  }
  return sorted;
}

lockData.importers = sortObject(lockData.importers);
lockData.packages = sortObject(lockData.packages);
lockData.snapshots = sortObject(lockData.snapshots);

const yamlLines = [];
for (const [key, value] of Object.entries(lockData)) {
  if (value && typeof value === 'object') {
    yamlLines.push(`${key}:`);
    yamlLines.push(...toYaml(value, 2));
  } else {
    yamlLines.push(`${key}: ${formatScalar(value)}`);
  }
}

yamlLines.push('');

fs.writeFileSync(path.join(repoRoot, 'pnpm-lock.yaml'), yamlLines.join('\n'));
