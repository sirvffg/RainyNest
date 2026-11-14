-- 访客 IP 获取方式（auto/x-forwarded-for/x-real-ip/cf-connecting-ip/direct）
ALTER TABLE "SiteSetting" ADD COLUMN "ipSource" TEXT NOT NULL DEFAULT 'auto';
