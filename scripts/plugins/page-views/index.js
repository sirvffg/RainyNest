"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// plugins/page-views/admin.tsx
var admin_exports = {};
__export(admin_exports, {
  default: () => PageViewsAdminPage
});
function loadData() {
  try {
    const raw = JSON.parse(
      import_node_fs.default.readFileSync(
        import_node_path.default.join(process.cwd(), "db", "plugins-json", "page-views.run.json"),
        "utf-8"
      )
    );
    const map = raw.paths || {};
    const rows = Object.entries(map).map(([p, v]) => ({
      path: p,
      count: Number(v?.count) || 0,
      updatedAt: String(v?.updatedAt || "")
    }));
    rows.sort((a, b) => b.count - a.count);
    const total = rows.reduce((s, r) => s + r.count, 0);
    return { rows: rows.slice(0, 20), total, pathCount: rows.length };
  } catch {
    return { rows: [], total: 0, pathCount: 0 };
  }
}
function PageViewsAdminPage() {
  const { rows, total, pathCount } = loadData();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "space-y-4", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-4", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rounded-lg border border-line bg-bg-secondary p-4", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "text-xs text-fg-muted", children: "\u603B\u6D4F\u89C8\u91CF" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "mt-1 text-2xl font-bold tabular-nums", children: total })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rounded-lg border border-line bg-bg-secondary p-4", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "text-xs text-fg-muted", children: "\u88AB\u7EDF\u8BA1\u8DEF\u5F84" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "mt-1 text-2xl font-bold tabular-nums", children: pathCount })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "overflow-hidden rounded-lg border border-line", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { className: "w-full text-sm", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { className: "bg-bg-secondary text-left text-xs text-fg-muted", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "px-4 py-2 font-medium", children: "\u8DEF\u5F84" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "px-4 py-2 font-medium", children: "\u6D4F\u89C8\u6B21\u6570" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "hidden px-4 py-2 font-medium sm:table-cell", children: "\u6700\u8FD1\u6D4F\u89C8" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [
        rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { className: "border-t border-line", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "max-w-[16rem] truncate px-4 py-2 font-mono text-xs", children: row.path }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "px-4 py-2 tabular-nums", children: row.count }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "hidden px-4 py-2 text-xs text-fg-muted sm:table-cell", children: row.updatedAt ? new Date(row.updatedAt).toLocaleString("zh-CN") : "-" })
        ] }, row.path)),
        rows.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { colSpan: 3, className: "px-4 py-8 text-center text-sm text-fg-muted", children: "\u6682\u65E0\u6D4F\u89C8\u6570\u636E" }) })
      ] })
    ] }) })
  ] });
}
var import_node_fs, import_node_path, import_jsx_runtime;
var init_admin = __esm({
  "plugins/page-views/admin.tsx"() {
    "use strict";
    import_node_fs = __toESM(require("node:fs"));
    import_node_path = __toESM(require("node:path"));
    import_jsx_runtime = require("react/jsx-runtime");
  }
});

// plugins/page-views/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => pageViewsPlugin
});
module.exports = __toCommonJS(index_exports);
var import_react = __toESM(require("react"));
var paths = /* @__PURE__ */ new Map();
var loaded = false;
function pageViewsPlugin(ctx) {
  async function load() {
    if (loaded) return;
    loaded = true;
    const data = await ctx.pluginJson.get();
    const map = data.paths || {};
    for (const [p, v] of Object.entries(map)) {
      paths.set(p, { count: Number(v?.count) || 0, updatedAt: String(v?.updatedAt || "") });
    }
    if (!data.migratedFromSqlite) {
      await migrateFromSqlite();
      await persist();
      await ctx.pluginJson.set({ migratedFromSqlite: true });
    }
  }
  async function migrateFromSqlite() {
    try {
      const Database = require("better-sqlite3");
      const db = new Database(
        `${process.cwd()}/db/plugins/page-views.db`,
        { readonly: true }
      );
      const rows = db.prepare("SELECT path, count, updated_at FROM path_views").all();
      db.close();
      for (const r of rows) {
        const prev = paths.get(r.path);
        const count = Math.max(r.count || 0, prev?.count || 0);
        const updatedAt = r.updated_at || prev?.updatedAt || "";
        paths.set(r.path, { count, updatedAt });
      }
      if (rows.length) ctx.logger.info(`\u5DF2\u4ECE\u65E7 SQLite \u8FC1\u79FB ${rows.length} \u6761 PV \u6570\u636E`);
    } catch {
    }
  }
  async function persist() {
    const obj = {};
    for (const [p, v] of paths.entries()) obj[p] = v;
    await ctx.pluginJson.set({ paths: obj });
  }
  function total() {
    let sum = 0;
    for (const v of paths.values()) sum += v.count;
    return sum;
  }
  return {
    // 启动时加载数据
    async onMount() {
      await load();
      ctx.logger.info(`PV \u6570\u636E\u5DF2\u5C31\u7EEA\uFF08${paths.size} \u4E2A\u8DEF\u5F84\uFF0C\u7D2F\u8BA1 ${total()}\uFF09`);
    },
    // 每次页面浏览：内存计数 + 落盘
    async onPageView({ path: path2 }) {
      if (!path2) return;
      await load();
      const prev = paths.get(path2);
      paths.set(path2, { count: (prev?.count || 0) + 1, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
      await persist();
    },
    // 后台扩展页面：注入控制台菜单 + 独立管理页
    customAdminRoutes: [
      {
        path: "stats",
        title: "\u8BBF\u95EE\u7EDF\u8BA1",
        group: "\u5DE5\u5177",
        component: () => Promise.resolve().then(() => (init_admin(), admin_exports))
      }
    ],
    // 文章保存成功后：记录日志（示例）
    afterSavePost(post) {
      ctx.logger.info(`\u6587\u7AE0\u5DF2\u4FDD\u5B58\u300C${post.title ?? post.slug}\u300D`);
    },
    // 文章列表行操作按钮（链接型，{id}/{slug} 占位符）
    postListItemOperation: [
      {
        label: "\u6D4F\u89C8\u660E\u7EC6",
        icon: "eye",
        variant: "outline",
        onClick: "/console/plugin-ext/page-views/stats?postId={id}"
      }
    ],
    // 仪表盘小部件（闭包组件：读内存缓存，同步渲染）
    dashboardWidget: [
      {
        title: "\u63D2\u4EF6 PV \u7EDF\u8BA1",
        icon: "bar-chart",
        component: function PvWidget() {
          return import_react.default.createElement(
            "div",
            null,
            import_react.default.createElement("div", { style: { fontSize: 13, color: "#64748b", marginBottom: 6 } }, "\u7D2F\u8BA1 PV\uFF08page-views\uFF09"),
            import_react.default.createElement("div", { style: { fontSize: 26, fontWeight: 700, lineHeight: 1.2 } }, String(total())),
            import_react.default.createElement("div", { style: { fontSize: 12, color: "#94a3b8", marginTop: 8 } }, "\u6253\u5F00\u300C\u5DE5\u5177 \u2192 \u8BBF\u95EE\u7EDF\u8BA1\u300D\u67E5\u770B\u660E\u7EC6")
          );
        }
      }
    ],
    // 前台页脚注入：统计标记
    injectFooter() {
      return ["<!-- page-views active -->"];
    },
    customApi: [
      {
        method: "GET",
        path: "/count",
        auth: false,
        handler: async (req) => {
          await load();
          const path2 = new URL(req.url).searchParams.get("path");
          if (!path2) {
            return new Response(JSON.stringify({ error: "missing path" }), {
              status: 400,
              headers: { "Content-Type": "application/json; charset=utf-8" }
            });
          }
          return new Response(
            JSON.stringify({ path: path2, count: paths.get(path2)?.count ?? 0 }),
            { headers: { "Content-Type": "application/json; charset=utf-8" } }
          );
        }
      }
    ]
  };
}
