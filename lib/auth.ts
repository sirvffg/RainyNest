// lib/auth.ts — NextAuth 5 完整配置（Node Runtime）
// providers 使用 async 配置函数动态读取 SiteSetting：OAuth 配置留空则不启用
// 即使数据库在构建阶段不可用，getSiteSetting 也会回退默认值，不会让 build 崩溃

import NextAuth, { CredentialsSignin } from 'next-auth';
import type { NextAuthConfig, User, Account, Profile } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import WeChat from 'next-auth/providers/wechat';
import bcrypt from 'bcryptjs';
import { db } from './prisma';
import { authConfig } from './auth.config';
import { getSiteSetting } from './site';
import { verifyCode } from './verification';
import { authenticateLdap } from './ldap';
import { createSession } from './session-store';
import type { SiteSetting } from '@prisma/client';

// 登录失败时可返回给客户端的错误码（SignInForm 据此显示中文提示）
class LoginError extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}

// 登录成功时需要缓存在 JWT 里的用户字段
const userInclude = {
  roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
} as const;

type UserWithRoles = NonNullable<Awaited<ReturnType<typeof findUserWithRoles>>>;

/** 统一的用户查询（含角色与权限） */
async function findUserWithRoles(where: { id: string } | { username: string } | { email: string }) {
  return db.user.findUnique({ where, include: userInclude });
}

/** 把数据库用户转换为 NextAuth 用户对象 */
function toAuthUser(user: UserWithRoles) {
  const roleNames = user.roles.map((ur) => ur.role.name);
  const isAdmin = roleNames.includes('administrator');
  const forbidConsole = user.roles.some((ur) => ur.role.forbidConsole);
  const permissions = isAdmin
    ? ['*']
    : user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.name));

  return {
    id: user.id,
    username: user.username,
    name: user.displayName,
    email: user.email,
    roles: roleNames,
    permissions,
    forbidConsole,
  };
}

/** 账号可用性检查（禁用 / 锁定） */
function assertAccountUsable(user: UserWithRoles) {
  if (user.status !== 'ENABLED') throw new LoginError('ACCOUNT_DISABLED');
  if (user.lockedUntil && user.lockedUntil > new Date()) throw new LoginError('ACCOUNT_LOCKED');
}

/** 读取当前请求的 UA / IP（用于登录设备记录，失败不影响登录） */
async function readRequestMeta(): Promise<{ userAgent?: string; ip?: string }> {
  try {
    const { headers } = await import('next/headers');
    const h = await headers();
    const ip =
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip') ||
      h.get('cf-connecting-ip') ||
      undefined;
    return { userAgent: h.get('user-agent') || undefined, ip };
  } catch {
    return {};
  }
}

/** OAuth 登录：把第三方账号映射到本地用户（找不到则由 signIn 回调拒绝） */
async function resolveOAuthLocalUser(
  user: User | { email?: string | null },
  account?: Account | null,
  profile?: Profile,
): Promise<UserWithRoles | null> {
  if (!account || account.type !== 'oauth') return null;
  if (account.provider === 'wechat') {
    const openid = (profile as { openid?: string } | undefined)?.openid;
    if (!openid) return null;
    const identity = await db.identity.findUnique({
      where: { provider_identifier: { provider: 'OAUTH2_WECHAT', identifier: openid } },
      include: { user: { include: userInclude } },
    });
    return identity?.user ?? null;
  }
  if (!user?.email) return null;
  return findUserWithRoles({ email: user.email });
}

/** 构造动态 providers（OAuth 凭据留空即不启用） */
function buildProviders(site: SiteSetting): NextAuthConfig['providers'] {
  const providers: NextAuthConfig['providers'] = [
    // 用户名 / 邮箱 + 密码登录
    Credentials({
      credentials: { username: {}, password: {} },
      authorize: async (credentials) => {
        const username = typeof credentials?.username === 'string' ? credentials.username.trim() : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';
        if (!username || !password) return null;

        const ldapEnabled = site.enableLdap === true;

        const user = await db.user.findFirst({
          where: { OR: [{ username }, { email: username }] },
          include: userInclude,
        });

        // 本地校验失败时尝试 LDAP
        if (!user) {
          if (ldapEnabled) {
            try {
              await authenticateLdap(username, password);
              // LDAP 认证成功但本地无账号 → 提示先注册
              throw new LoginError('LDAP_NOT_REGISTERED');
            } catch (err) {
              if (err instanceof LoginError) throw err;
              return null;
            }
          }
          return null;
        }

        assertAccountUsable(user);

        const valid = await bcrypt.compare(password, user.passwordHash || '');
        if (!valid) {
          if (!ldapEnabled) return null;
          let ldapProfile;
          try {
            ldapProfile = await authenticateLdap(username, password);
          } catch {
            return null;
          }
          // LDAP 通过后按邮箱 / 用户名匹配本地账号，不存在则拒绝
          const local = await db.user.findFirst({
            where: {
              OR: [
                { username },
                ...(ldapProfile.mail ? [{ email: ldapProfile.mail }] : []),
              ],
            },
            include: userInclude,
          });
          if (!local) throw new LoginError('LDAP_NOT_REGISTERED');
          assertAccountUsable(local);

          void db.user.update({ where: { id: local.id }, data: { lastLoginAt: new Date() } }).catch(() => {});
          return toAuthUser(local);
        }

        // 记录最后登录时间（fire-and-forget，失败不影响登录）
        void db.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(() => {});

        return toAuthUser(user);
      },
    }),

    // 邮箱验证码登录（仅登录已存在的用户）
    Credentials({
      id: 'email-code',
      name: '邮箱验证码',
      credentials: { email: {}, code: {} },
      authorize: async (credentials) => {
        const email = typeof credentials?.email === 'string' ? credentials.email.trim() : '';
        const code = typeof credentials?.code === 'string' ? credentials.code.trim() : '';
        if (!email || !code) return null;

        const user = await findUserWithRoles({ email });
        if (!user) return null;
        assertAccountUsable(user);

        const ok = await verifyCode({ target: email, channel: 'EMAIL', purpose: 'LOGIN', code });
        if (!ok) throw new LoginError('CODE_INVALID');

        void db.user
          .update({
            where: { id: user.id },
            data: { lastLoginAt: new Date(), ...(user.emailVerified ? {} : { emailVerified: new Date() }) },
          })
          .catch(() => {});

        return toAuthUser(user);
      },
    }),
  ];

  if (site.oauthGithubId && site.oauthGithubSecret) {
    providers.push(
      GitHub({
        clientId: site.oauthGithubId,
        clientSecret: site.oauthGithubSecret,
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }
  if (site.oauthGoogleId && site.oauthGoogleSecret) {
    providers.push(
      Google({
        clientId: site.oauthGoogleId,
        clientSecret: site.oauthGoogleSecret,
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }
  if (site.oauthWechatId && site.oauthWechatSecret) {
    providers.push(
      WeChat({
        clientId: site.oauthWechatId,
        clientSecret: site.oauthWechatSecret,
        platformType: 'WebsiteApp',
      }),
    );
  }

  return providers;
}

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const site = await getSiteSetting();

  return {
    ...authConfig,
    providers: buildProviders(site),
    callbacks: {
      ...authConfig.callbacks,

      // OAuth 登录时只允许已存在且启用的本地账号
      signIn: async ({ user, account, profile }) => {
        if (!account || account.type !== 'oauth') return true;
        try {
          const local = await resolveOAuthLocalUser(user, account, profile);
          return !!local && local.status === 'ENABLED' && !(local.lockedUntil && local.lockedUntil > new Date());
        } catch {
          return false;
        }
      },

      jwt: async ({ token, user, account, profile }) => {
        if (user) {
          // 登录成功：写入角色 / 权限，并创建一条登录设备记录
          type TokenUser = {
            id: string;
            username?: string;
            name?: string | null;
            email?: string | null;
            roles?: string[];
            permissions?: string[];
            forbidConsole?: boolean;
          };
          let authUser: TokenUser | null = null;
          let localUser: UserWithRoles | null = null;

          if (account?.type === 'oauth') {
            try {
              localUser = await resolveOAuthLocalUser(user, account, profile);
            } catch {
              localUser = null;
            }
            if (localUser) authUser = toAuthUser(localUser);
          }

          if (!authUser) {
            authUser = {
              id: user.id ?? token.sub ?? '',
              username: user.username,
              name: user.name ?? null,
              email: user.email ?? null,
              roles: user.roles,
              permissions: user.permissions,
              forbidConsole: user.forbidConsole,
            };
          }

          token.sub = authUser.id;
          token.username = authUser.username;
          token.roles = authUser.roles;
          token.permissions = authUser.permissions;
          token.forbidConsole = authUser.forbidConsole;

          // ⭐ 仅登录时写一次 Session 表，后续请求不再写库
          try {
            const meta = await readRequestMeta();
            const created = await createSession({
              userId: authUser.id,
              userAgent: meta.userAgent,
              ip: meta.ip,
            });
            token.sessionToken = created.token;
          } catch {
            /* 会话记录失败不影响登录 */
          }
        }
        return token;
      },

      session: ({ session, token }) => {
        if (session.user) {
          const u = session.user as { id?: string; sessionToken?: string };
          u.id = token.sub ?? u.id;
          session.user.username = token.username;
          session.user.roles = token.roles;
          session.user.permissions = token.permissions;
          session.user.forbidConsole = token.forbidConsole;
          u.sessionToken = token.sessionToken;
        }
        return session;
      },
    },
  };
});
