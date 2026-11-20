// lib/image.ts — 图片处理（EXIF 方向校正 + 宽高读取）
// sharp 为可选依赖：未安装或处理失败时原样返回，不阻塞上传
export interface NormalizedImage {
  buffer: Buffer;
  width?: number;
  height?: number;
}

export async function normalizeImage(buffer: Buffer): Promise<NormalizedImage> {
  try {
    // 运行时动态加载，未安装 sharp 时直接跳过（不写死依赖）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(/* webpackIgnore: true */ 'sharp' as string);
    const sharp = mod?.default ?? mod;
    if (typeof sharp !== 'function') return { buffer };

    // rotate() 无参数时按 EXIF Orientation 自动转正
    const result: {
      data: Buffer;
      info?: { width?: number; height?: number };
    } = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: result.data,
      width: result.info?.width,
      height: result.info?.height,
    };
  } catch {
    // sharp 未安装 / 格式不支持：安静跳过
    return { buffer };
  }
}
