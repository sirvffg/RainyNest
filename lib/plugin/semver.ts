// lib/plugin/semver.ts — 极简 semver 比较（无第三方依赖）
// 仅覆盖插件 requiresCore 所需语法：x.y.z、>=、>、<=、<、=、^、~
// 另外支持用空格连接的多条件（AND）与 || 分隔的多区间（OR）
import fs from 'node:fs';
import path from 'node:path';

export type SemverTuple = [number, number, number];

// 解析版本号核心段（忽略 v 前缀与 -prerelease / +build 后缀）
export function parseVersion(input: string): SemverTuple | null {
  if (!input) return null;
  const matched = String(input)
    .trim()
    .replace(/^v/i, '')
    .match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!matched) return null;
  return [Number(matched[1]), Number(matched[2] ?? 0), Number(matched[3] ?? 0)];
}

// 比较两个版本：a > b 返回 1，a < b 返回 -1，相等/无法解析返回 0
export function compareSemver(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return 0;
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}

function compareTuple(a: SemverTuple, b: SemverTuple): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  }
  return 0;
}

// 单个比较条件，如 ">=1.0.0" / "^1.2.3"
function matchesComparator(current: SemverTuple, token: string): boolean {
  const matched = token.match(/^(>=|<=|>|<|=|\^|~)?\s*v?(\d+(?:\.\d+){0,2})$/);
  if (!matched) return false;
  const op = matched[1] || '=';
  const base = parseVersion(matched[2]);
  if (!base) return false;

  const cmp = compareTuple(current, base);
  switch (op) {
    case '>=':
      return cmp >= 0;
    case '>':
      return cmp > 0;
    case '<=':
      return cmp <= 0;
    case '<':
      return cmp < 0;
    case '=':
      return cmp === 0;
    case '^': {
      // 主版本非 0 时锁主版本；0.x 锁次版本；0.0.x 锁补丁号
      let upper: SemverTuple;
      if (base[0] > 0) upper = [base[0] + 1, 0, 0];
      else if (base[1] > 0) upper = [0, base[1] + 1, 0];
      else upper = [0, 0, base[2] + 1];
      return cmp >= 0 && compareTuple(current, upper) < 0;
    }
    case '~': {
      // 锁定主次版本，补丁号可升
      const upper: SemverTuple = [base[0], base[1] + 1, 0];
      return cmp >= 0 && compareTuple(current, upper) < 0;
    }
    default:
      return false;
  }
}

// 判断当前核心版本是否满足要求；空要求或 "*" 视为不限制
export function satisfiesCoreVersion(currentVersion: string, requirement: string): boolean {
  const current = parseVersion(currentVersion);
  const req = String(requirement ?? '').trim();
  if (!req || req === '*') return true;
  if (!current) return false;

  return req.split('||').some((part) => {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return true;
    return tokens.every((token) => matchesComparator(current, token));
  });
}

// 读取宿主核心版本（主项目 package.json 的 version），进程内缓存
let cachedCoreVersion: string | null = null;
export function getCoreVersion(): string {
  if (cachedCoreVersion) return cachedCoreVersion;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
    cachedCoreVersion = String(pkg.version || '0.0.0');
  } catch {
    cachedCoreVersion = '0.0.0';
  }
  return cachedCoreVersion;
}
