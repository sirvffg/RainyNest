"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
module.exports = __toCommonJS(admin_exports);
var import_node_fs = __toESM(require("node:fs"));
var import_node_path = __toESM(require("node:path"));
var import_jsx_runtime = require("react/jsx-runtime");
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
