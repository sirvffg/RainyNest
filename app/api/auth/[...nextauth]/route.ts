// app/api/auth/[...nextauth]/route.ts — NextAuth 5 路由处理器
import { handlers } from '@/lib/auth';

export const runtime = 'nodejs';

export const { GET, POST } = handlers;
