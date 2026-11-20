// lib/plugin/role-templates.ts — 导入插件声明的角色模板（plugin.json 的 roleTemplates）
// 流程：先 upsert Permission，再 upsert RoleTemplate 并重建模板权限关联
import { db } from '../prisma';
import type { LoadedPlugin } from './types';

export async function importRoleTemplates(plugins: LoadedPlugin[]): Promise<void> {
  for (const plugin of plugins) {
    const templates = plugin.meta.roleTemplates;
    if (!templates?.length) continue;

    try {
      for (const template of templates) {
        const permissionIds: string[] = [];

        // ① 权限先落库（插件声明的权限可能尚未出现在 Permission 表）
        for (const name of template.permissions ?? []) {
          if (!name) continue;
          const permission = await db.permission.upsert({
            where: { name },
            update: {},
            create: {
              name,
              displayName: name,
              group: plugin.meta.name || plugin.slug,
            },
            select: { id: true },
          });
          permissionIds.push(permission.id);
        }

        // ② 角色模板 upsert
        const dependsOn = template.dependsOn?.length ? JSON.stringify(template.dependsOn) : null;
        const roleTemplate = await db.roleTemplate.upsert({
          where: { name: template.name },
          update: {
            displayName: template.displayName,
            description: template.description ?? null,
            pluginSlug: plugin.slug,
            dependsOn,
          },
          create: {
            name: template.name,
            displayName: template.displayName,
            description: template.description ?? null,
            pluginSlug: plugin.slug,
            dependsOn,
          },
          select: { id: true },
        });

        // ③ 重建模板与权限的关联
        await db.roleTemplatePermission.deleteMany({ where: { roleTemplateId: roleTemplate.id } });
        if (permissionIds.length > 0) {
          await db.roleTemplatePermission.createMany({
            data: permissionIds.map((permissionId) => ({ roleTemplateId: roleTemplate.id, permissionId })),
          });
        }
      }
    } catch (err) {
      // 模板导入失败只记日志，不影响插件加载
      console.error(`[Plugin] ${plugin.slug} roleTemplates 导入失败:`, err);
    }
  }
}
