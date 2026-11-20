// lib/ldap.ts — LDAP 简单认证（bind + search）
// ldapjs 为可选依赖：未安装时抛出明确错误，不影响构建
import { getSiteSetting } from './site';

export interface LdapProfile {
  dn: string;
  mail?: string;
  uid?: string;
  cn?: string;
}

/** 转义 LDAP 过滤器中的特殊字符（RFC 4515） */
function escapeFilterValue(value: string): string {
  return value.replace(/[\\*()\0]/g, (ch) => `\\${ch.charCodeAt(0).toString(16).padStart(2, '0')}`);
}

// 用变量拼接模块名，避免未安装可选依赖时构建阶段强制解析失败
async function loadLdapjs(): Promise<any> {
  const moduleName = 'ldapjs';
  try {
    const mod = await import(/* webpackIgnore: true */ moduleName);
    const ldap = (mod as any)?.default ?? mod;
    if (!ldap?.createClient) throw new Error('invalid module');
    return ldap;
  } catch {
    throw new Error('未安装 ldapjs，无法使用 LDAP 登录，请先安装依赖 ldapjs');
  }
}

/** 包装 ldapjs 回调为 Promise（带超时） */
function callLdap<T>(fn: (cb: (err: Error | null, value?: T) => void) => void, timeoutMs = 8000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('LDAP 服务响应超时')), timeoutMs);
    fn((err, value) => {
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(value as T);
    });
  });
}

function unbindQuietly(client: any) {
  try {
    client.unbind(() => {});
  } catch {
    /* 忽略解绑异常 */
  }
}

/**
 * 使用 LDAP 校验用户名密码。
 * 流程：服务账号 bind → 按 ldapUserFilter（含 {username}）搜索用户 DN → 用用户 DN + 密码 bind。
 */
export async function authenticateLdap(username: string, password: string): Promise<LdapProfile> {
  const site = await getSiteSetting();
  if (!site.enableLdap) {
    throw new Error('LDAP 登录未启用');
  }
  if (!site.ldapUrl) {
    throw new Error('LDAP 服务地址未配置');
  }
  if (!site.ldapBaseDn) {
    throw new Error('LDAP Base DN 未配置');
  }
  if (!username || !password) {
    throw new Error('LDAP 用户名或密码不能为空');
  }

  const ldap = await loadLdapjs();
  const filterTemplate = site.ldapUserFilter || '(uid={username})';
  const filter = filterTemplate.replace(/\{username\}/g, escapeFilterValue(username));

  // ① 用服务账号（或匿名）搜索目标用户
  const searchClient = ldap.createClient({ url: site.ldapUrl, connectTimeout: 8000 });
  try {
    if (site.ldapBindDn) {
      await callLdap<boolean>((cb) => searchClient.bind(site.ldapBindDn as string, site.ldapBindPassword || '', cb));
    } else {
      await callLdap<boolean>((cb) => searchClient.bind('', '', cb));
    }

    const entry = await new Promise<{ dn: string; object: Record<string, any> }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('LDAP 搜索超时')), 8000);
      let found: { dn: string; object: Record<string, any> } | null = null;
      searchClient.search(
        site.ldapBaseDn as string,
        { filter, scope: 'sub', attributes: ['dn', 'mail', 'uid', 'cn'] },
        (err: Error | null, res: any) => {
          if (err) {
            clearTimeout(timer);
            reject(err);
            return;
          }
          res.on('searchEntry', (item: any) => {
            if (!found) {
              found = {
                dn: item.dn?.toString?.() ?? String(item.dn ?? ''),
                object: item.object ?? item.pojo ?? {},
              };
            }
          });
          res.on('error', (searchErr: Error) => {
            clearTimeout(timer);
            reject(searchErr);
          });
          res.on('end', () => {
            clearTimeout(timer);
            if (found) resolve(found);
            else reject(new Error('LDAP 中未找到该用户'));
          });
        },
      );
    });

    unbindQuietly(searchClient);

    // ② 用搜索到的用户 DN 校验密码
    const userClient = ldap.createClient({ url: site.ldapUrl, connectTimeout: 8000 });
    try {
      await callLdap<boolean>((cb) => userClient.bind(entry.dn, password, cb));
    } catch {
      throw new Error('LDAP 用户名或密码错误');
    } finally {
      unbindQuietly(userClient);
    }

    const mail = typeof entry.object.mail === 'string' ? entry.object.mail : undefined;
    const uid = typeof entry.object.uid === 'string' ? entry.object.uid : undefined;
    const cn = typeof entry.object.cn === 'string' ? entry.object.cn : undefined;

    return { dn: entry.dn, mail, uid, cn };
  } catch (err) {
    unbindQuietly(searchClient);
    throw err instanceof Error ? err : new Error('LDAP 认证失败');
  }
}
