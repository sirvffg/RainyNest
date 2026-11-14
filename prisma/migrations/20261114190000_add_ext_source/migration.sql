-- 扩展包体系：Plugin/Theme 增加 source 字段（builtin=内置预装 uploaded=后台上传）
ALTER TABLE "Plugin" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'builtin';
ALTER TABLE "Theme" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'builtin';
