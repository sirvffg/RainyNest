"use strict";
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

// src/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => helloPlugin
});
module.exports = __toCommonJS(index_exports);
function helloPlugin(ctx) {
  const cfg = ctx.config || {};
  const message = cfg.message || "Hello from my-hello!";
  return {
    // <head> 注入一条标记注释，前台查看源码即可确认插件生效
    injectHead() {
      if (cfg.enabled === false) return [];
      return [`<!-- my-hello: ${message} -->`];
    },
    // 自定义 API：GET /api/plugin/my-hello/greet
    // 每次调用 pluginJson 计数 +1，验证运行数据持久化
    customApi: [
      {
        method: "GET",
        path: "/greet",
        auth: false,
        handler: async () => {
          const data = await ctx.pluginJson.get();
          const count = Number(data.count || 0) + 1;
          await ctx.pluginJson.set({ count, lastMessage: message });
          return new Response(
            JSON.stringify({ ok: true, count, message }),
            { headers: { "Content-Type": "application/json; charset=utf-8" } }
          );
        }
      }
    ]
  };
}
