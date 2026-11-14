-- CreateTable
CREATE TABLE "PageView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "path" TEXT NOT NULL,
    "postId" TEXT,
    "referer" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,
    "country" TEXT,
    "device" TEXT,
    "duration" INTEGER,
    "sessionId" TEXT,
    "uniqueKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "OnlineVisitor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "ip" TEXT,
    "path" TEXT,
    "userAgent" TEXT,
    "firstSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DailyStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "pv" INTEGER NOT NULL DEFAULT 0,
    "uv" INTEGER NOT NULL DEFAULT 0,
    "newVisitors" INTEGER NOT NULL DEFAULT 0,
    "avgDuration" REAL NOT NULL DEFAULT 0,
    "topPath" TEXT,
    "topPathPv" INTEGER NOT NULL DEFAULT 0,
    "topPostId" TEXT,
    "topPostPv" INTEGER NOT NULL DEFAULT 0,
    "referers" TEXT,
    "devices" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HourlyStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hour" DATETIME NOT NULL,
    "pv" INTEGER NOT NULL DEFAULT 0,
    "uv" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "PostDailyView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "pv" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE INDEX "PageView_path_idx" ON "PageView"("path");

-- CreateIndex
CREATE INDEX "PageView_postId_idx" ON "PageView"("postId");

-- CreateIndex
CREATE INDEX "PageView_createdAt_idx" ON "PageView"("createdAt");

-- CreateIndex
CREATE INDEX "PageView_sessionId_idx" ON "PageView"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PageView_uniqueKey_key" ON "PageView"("uniqueKey");

-- CreateIndex
CREATE UNIQUE INDEX "OnlineVisitor_sessionId_key" ON "OnlineVisitor"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStat_date_key" ON "DailyStat"("date");

-- CreateIndex
CREATE UNIQUE INDEX "HourlyStat_hour_key" ON "HourlyStat"("hour");

-- CreateIndex
CREATE INDEX "HourlyStat_hour_idx" ON "HourlyStat"("hour");

-- CreateIndex
CREATE INDEX "PostDailyView_postId_idx" ON "PostDailyView"("postId");

-- CreateIndex
CREATE INDEX "PostDailyView_date_idx" ON "PostDailyView"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PostDailyView_postId_date_key" ON "PostDailyView"("postId", "date");
