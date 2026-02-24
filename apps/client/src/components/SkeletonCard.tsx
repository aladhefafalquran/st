export function SkeletonCard() {
  return (
    <div className="flex-shrink-0 w-full">
      <div className="skeleton aspect-[2/3] w-full rounded-lg" />
      <div className="mt-2 px-0.5 space-y-1.5">
        <div className="skeleton h-3.5 w-4/5 rounded" />
        <div className="skeleton h-3 w-2/5 rounded" />
      </div>
    </div>
  )
}

export function SkeletonGrid({ count = 18 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )
}

export function SkeletonRow({ count = 7 }: { count?: number }) {
  return (
    <section className="mb-8">
      <div className="skeleton h-5 w-40 rounded mb-3 mx-4 sm:mx-8" />
      <div className="flex gap-3 overflow-hidden px-4 sm:px-8 pb-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-36 sm:w-44">
            <div className="skeleton aspect-[2/3] w-full rounded-lg" />
            <div className="mt-2 space-y-1.5 px-0.5">
              <div className="skeleton h-3.5 w-4/5 rounded" />
              <div className="skeleton h-3 w-2/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
