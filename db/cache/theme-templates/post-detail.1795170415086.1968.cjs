var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var stdin_exports = {};
__export(stdin_exports, {
  default: () => PostDetail
});
module.exports = __toCommonJS(stdin_exports);
var import_jsx_runtime = require("react/jsx-runtime");
function PostDetail({ post, html, commentsCount, slots }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "rounded-lg border border-primary/40 bg-primary/5 p-3 mb-6 text-sm anim-fade-in-up", children: "\u{1F3A8} \u672C\u9875\u9762\u7531\u4E3B\u9898\u81EA\u5B9A\u4E49\u6A21\u677F\u6E32\u67D3\uFF08scripts/themes/default/templates/post-detail.tsx\uFF09" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { className: "text-3xl md:text-4xl font-bold leading-tight", children: post.title }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "mt-4 text-sm text-fg-muted", children: [
      post.author,
      " \xB7 ",
      post.views,
      " \u6B21\u6D4F\u89C8 \xB7 ",
      commentsCount,
      " \u6761\u8BC4\u8BBA"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        className: "mt-8 markdown-body",
        dangerouslySetInnerHTML: { __html: html }
      }
    ),
    slots.contentBlocks,
    slots.comments
  ] });
}
