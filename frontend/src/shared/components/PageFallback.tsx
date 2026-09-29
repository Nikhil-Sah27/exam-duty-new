/**
 * Suspense fallback shown while a lazy route chunk downloads. Kept in the
 * shared layer so layouts and App can use it without importing each other.
 */
export default function PageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />
    </div>
  );
}
