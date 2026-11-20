-- 补全功能：评论扩展字段 / 页面侧边栏 / 附件库 / 验证码 / 站点扩展配置

ALTER TABLE "Comment" ADD COLUMN "ip" TEXT;
ALTER TABLE "Comment" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "Comment" ADD COLUMN "extra" TEXT;

ALTER TABLE "Page" ADD COLUMN "showSidebar" BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE "Page" ADD COLUMN "sidebarContent" TEXT;

ALTER TABLE "SiteSetting" ADD COLUMN "enableSectionize" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "SiteSetting" ADD COLUMN "codeTabGroup" BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE "SiteSetting" ADD COLUMN "enableFigure" BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE "SiteSetting" ADD COLUMN "enableMermaid" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "SiteSetting" ADD COLUMN "enablePlantuml" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "SiteSetting" ADD COLUMN "autoBackupCron" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "autoBackupKeep" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "SiteSetting" ADD COLUMN "allowThemeGitInstall" BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE "SiteSetting" ADD COLUMN "oauthGithubId" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "oauthGithubSecret" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "oauthGoogleId" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "oauthGoogleSecret" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "oauthWechatId" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "oauthWechatSecret" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "enableLdap" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "SiteSetting" ADD COLUMN "ldapUrl" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "ldapBindDn" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "ldapBindPassword" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "ldapBaseDn" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "ldapUserFilter" TEXT;

CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER NOT NULL DEFAULT 0,
    "storage" TEXT NOT NULL DEFAULT 'local',
    "uploaderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Attachment_createdAt_idx" ON "Attachment"("createdAt");

CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "target" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "purpose" TEXT NOT NULL DEFAULT 'LOGIN',
    "code" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "VerificationCode_target_purpose_idx" ON "VerificationCode"("target", "purpose");
CREATE INDEX "VerificationCode_expiresAt_idx" ON "VerificationCode"("expiresAt");
