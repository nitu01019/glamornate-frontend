import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-brand-maroon-500 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Page not found</h2>
        <p className="text-gray-500 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/services"
            className="px-6 py-2.5 bg-brand-maroon-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-maroon-600 transition-colors"
          >
            Browse Services
          </Link>
          <Link
            href="/"
            className="px-6 py-2.5 border border-brand-maroon-500 text-brand-maroon-500 rounded-xl text-sm font-semibold hover:bg-brand-maroon-50 transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
