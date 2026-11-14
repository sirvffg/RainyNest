import GalleryPhotoEditor from './GalleryPhotoEditor';

export const metadata = { title: '编辑相册照片' };

export default async function GalleryEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <GalleryPhotoEditor slug={decodeURIComponent(slug)} />;
}
