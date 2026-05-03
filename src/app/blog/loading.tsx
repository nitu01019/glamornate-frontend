export default function BlogLoading(): JSX.Element {
  return (
    <div
      className="min-h-screen bg-section-bg pb-24 animate-pulse"
      role="status"
      aria-label="Loading journal"
    >
      <div className="bg-white px-4 pt-14 pb-4">
        <div className="h-6 w-56 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-72 bg-gray-100 rounded" />
      </div>

      <div className="bg-white">
        <div className="flex gap-2 overflow-x-auto px-4 pb-4">
          {[0, 1, 2, 3, 4].map((key) => (
            <div key={key} className="h-8 w-20 bg-gray-100 rounded-full flex-shrink-0" />
          ))}
        </div>
      </div>

      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="w-full aspect-[16/10] bg-gray-100" />
          <div className="p-4 space-y-2">
            <div className="h-3 w-16 bg-gray-100 rounded-full" />
            <div className="h-5 w-3/4 bg-gray-200 rounded" />
            <div className="h-3 w-full bg-gray-100 rounded" />
            <div className="h-3 w-2/3 bg-gray-100 rounded" />
          </div>
        </div>
      </div>

      <div className="px-4 mt-4 space-y-3">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="flex gap-3 bg-white rounded-2xl shadow-sm p-3">
            <div className="w-24 h-24 rounded-xl bg-gray-100 flex-shrink-0" />
            <div className="flex flex-col justify-center gap-2 flex-1">
              <div className="h-4 w-5/6 bg-gray-200 rounded" />
              <div className="h-3 w-full bg-gray-100 rounded" />
              <div className="h-3 w-1/2 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      <span className="sr-only">Loading</span>
    </div>
  );
}
