import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '@/lib/marketing-api';

export function HeroEditorPage() {
  const queryClient = useQueryClient();
  const { data: slides = [], isLoading } = useQuery({
    queryKey: ['marketing', 'hero'],
    queryFn: () => marketingApi.listHeroSlides('draft'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      marketingApi.updateHeroSlide(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'hero'] }),
  });

  if (isLoading) return <p className="text-text-muted">Loading slides…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hero carousel</h1>
        <p className="mt-1 text-text-secondary">Edit home page hero slides (draft).</p>
      </div>

      <div className="space-y-4">
        {slides.map((slide) => (
          <form
            key={String(slide.id)}
            className="space-y-3 rounded-xl border border-white/10 bg-bg-card p-5"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              updateMutation.mutate({
                id: String(slide.id),
                body: {
                  headline: fd.get('headline'),
                  headlineAccent: fd.get('headlineAccent'),
                  subline: fd.get('subline'),
                  imageKey: fd.get('imageKey'),
                },
              });
            }}
          >
            <p className="text-sm font-medium text-text-muted">Slide {Number(slide.sortOrder) + 1}</p>
            <input
              name="headline"
              defaultValue={String(slide.headline)}
              className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm"
            />
            <input
              name="headlineAccent"
              defaultValue={String(slide.headlineAccent)}
              placeholder="Accent line"
              className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm"
            />
            <textarea
              name="subline"
              defaultValue={String(slide.subline)}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm"
            />
            <input
              name="imageKey"
              defaultValue={String(slide.imageKey ?? '')}
              placeholder="Image slot key (e.g. heroRestaurant)"
              className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-text-primary"
            >
              Save slide
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
