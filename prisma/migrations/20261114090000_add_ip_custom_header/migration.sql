-- 自定义代理头名称（配合 ipSource=custom 使用）
ALTER TABLE "SiteSetting" ADD COLUMN "ipCustomHeader" TEXT;
