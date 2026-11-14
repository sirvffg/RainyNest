// middleware.ts — 保护 /console/* 路由（Edge Runtime）
// ⚠️ 只能 import auth.config.ts（无 Node-only 依赖），不能 import Prisma

import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // ① 保护后台 /console/* 路由
  if (pathname.startsWith('/console')) {
    const session = req.auth;

    if (!session?.user) {
      const signInUrl = new URL('/signin', req.url);
      signInUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(signInUrl);
    }

    const roles = session.user.roles || [];
    const permissions = session.user.permissions || [];

    // 超级管理员直接放行
    if (roles.includes('administrator')) {
      return NextResponse.next();
    }

    // forbidConsole 角色（如 viewer）禁止访问后台
    if (session.user.forbidConsole === true) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    // 其他角色需要 console:login 权限（登录时已缓存进 JWT）
    if (!permissions.includes('console:login')) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/console/:path*'],
};
