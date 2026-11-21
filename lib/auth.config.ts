// lib/auth.config.ts — NextAuth 5 基础配置（Edge Runtime 安全）
// ⚠️ 此文件被 middleware.ts 引用，禁止 import Prisma / bcrypt / fs / nodemailer 等 Node-only 依赖

import type { NextAuthConfig, DefaultSession } from 'next-auth';

// session 扩展类型
declare module 'next-auth' {
  interface User {
    username?: string;
    roles?: string[];
    permissions?: string[];
    forbidConsole?: boolean;
  }
  interface Session {
    user: {
      id?: string;
      username?: string;
      roles?: string[];
      permissions?: string[];
      forbidConsole?: boolean;
      /** 当前设备的会话 token（用于"登录设备"区分当前设备） */
      sessionToken?: string;
    } & DefaultSession['user'];
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    username?: string;
    roles?: string[];
    permissions?: string[];
    forbidConsole?: boolean;
    /** 当前设备的会话 token（登录成功时写入一次） */
    sessionToken?: string;
    /** 权限快照上次从 DB 刷新的时间戳（服务端 jwt 回调定期自愈刷新） */
    permSyncedAt?: number;
  }
}

export const authConfig = {
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  pages: {
    signIn: '/signin',
  },
  session: { strategy: 'jwt' },
  providers: [], // 真正的 Credentials Provider（含 authorize）在 lib/auth.ts 里注册
  callbacks: {
    session: ({ session, token }) => {
      if (session.user) {
        const u = session.user as { id?: string };
        u.id = token.sub ?? u.id;
        session.user.username = token.username;
        session.user.roles = token.roles;
        session.user.permissions = token.permissions;
        session.user.forbidConsole = token.forbidConsole;
      }
      return session;
    },
    jwt: ({ token, user }) => {
      // 登录时把角色/权限写进 JWT token（Edge middleware 只读 token，不查库）
      if (user) {
        token.username = user.username;
        token.roles = user.roles;
        token.permissions = user.permissions;
        token.forbidConsole = user.forbidConsole;
      }
      return token;
    },
  },
} satisfies NextAuthConfig;
