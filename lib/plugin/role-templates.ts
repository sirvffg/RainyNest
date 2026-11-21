// lib/plugin/role-templates.ts — 导入插件声明的权限点与角色模板
// 流程：先 upsert plugin.json 的 permissions，再 upsert RoleTemplate 并重建模板权限关联
import { db } from '../prisma';
import type { LoadedPlugin } from './types';

// 插件声明的权限点逐个落库（name 唯一，displayName/group 取声明值）
// 注意：这里只做声明式注册，不代表插件代码受沙箱约束
export async function importPluginPermissions(plugins: LoadedPlugin[]): Promise<void> {
  for (const plugin of plugins) {
    const permissions = plugin.meta.permissions;
    if (!permissions?.length) continue;

    for (const permission of permissions) {
      if (!permission?.name) continue;
      const displayName = permission.displayName || permission.name;
      const group = permission.group || plugin.meta.name || plugin.slug;
      try {
        await db.permission.upsert({
          where: { name: permission.name },
          update: { displayName, group },
          create: { name: permission.name, displayName, group },
        });
      } catch (err) {
        // 权限点写入失败只记日志，不影响插件加载
        console.error(`[Plugin] ${plugin.slug} 权限点 ${permission.name} 写入失败:`, err);
      }
    }
  }
}

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
