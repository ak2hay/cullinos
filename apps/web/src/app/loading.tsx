export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-6 py-16 lg:px-10" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-24 rounded bg-border-light" />
      <div className="mt-6 h-10 w-2/3 max-w-xl rounded bg-border-light" />
      <div className="mt-4 h-4 w-full max-w-2xl rounded bg-border-light/80" />
      <div className="mt-2 h-4 w-5/6 max-w-xl rounded bg-border-light/60" />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 rounded-2xl border border-border-light bg-bg-card" />
        ))}
      </div>
    </div>
  );
}
