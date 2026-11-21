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
  default: () => AboutTemplate
});
module.exports = __toCommonJS(stdin_exports);
var import_jsx_runtime = require("react/jsx-runtime");
function AboutTemplate({ site }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { className: "mx-auto max-w-3xl px-4 py-16", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", { className: "text-3xl font-bold", children: [
      site.title,
      " \xB7 \u5173\u4E8E"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "mt-2 text-sm opacity-60", children: "\u8FD0\u884C\u65F6\u7F16\u8BD1\u515C\u5E95\u52A0\u8F7D\u6210\u529F\uFF08\u672A\u91CD\u542F dev\uFF09" })
  ] });
}
