import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-sm text-muted">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Sayfa bulunamadı</h1>
      <Link href="/" className="mt-6 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
        Ana sayfaya dön
      </Link>
    </div>
  );
}
