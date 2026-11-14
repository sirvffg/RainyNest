// lib/auth.ts — NextAuth 5 完整配置（Node Runtime）
// middleware 只引 auth.config.ts（Edge 安全），这里注册带 authorize 的 Credentials Provider

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from './prisma';
import { authConfig } from './auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      authorize: async (credentials) => {
        const username = typeof credentials?.username === 'string' ? credentials.username : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';
        if (!username || !password) return null;

        const user = await db.user.findUnique({
          where: { username },
          include: {
            roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
          },
        });
        if (!user || user.status !== 'ENABLED') return null;
        // 账户锁定检查
        if (user.lockedUntil && user.lockedUntil > new Date()) return null;

        const valid = await bcrypt.compare(password, user.passwordHash || '');
        if (!valid) return null;

        // 记录最后登录时间（fire-and-forget，失败不影响登录）
        void db.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(() => {});

        // ⭐ 登录成功时一次性查好角色 + 权限，缓存进 session/JWT
        const roleNames = user.roles.map((ur) => ur.role.name);
        const isAdmin = roleNames.includes('administrator');
        const forbidConsole = user.roles.some((ur) => ur.role.forbidConsole);

        // 聚合权限列表（超级管理员存 '*'，检查时直接放行）
        const permissionList = isAdmin
          ? ['*']
          : user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.name));

        return {
          id: user.id,
          username: user.username,
          name: user.displayName,
          email: user.email,
          roles: roleNames,
          permissions: permissionList,
          forbidConsole,
        };
      },
    }),
  ],
});
