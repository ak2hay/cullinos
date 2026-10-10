import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@cullinos/ui';
import { PageHeader, SectionCard } from '@/components/ui';
import { inputClass, LabeledInput, MutationError } from '@/components/common';
import { marketingApi } from '@/lib/marketing-api';

export function HeroEditorPage() {
  const queryClient = useQueryClient();
  const { data: slides = [], isLoading } = useQuery({
    queryKey: ['marketing', 'hero'],
    queryFn: () => marketingApi.listHeroSlides('draft'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => marketingApi.updateHeroSlide(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'hero'] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Hero carousel" description="Edit home page hero slides (draft). Publish from Marketing overview to go live." />
      <MutationError error={updateMutation.error} />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-xl bg-bg-secondary" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {slides.map((slide) => {
            const saving = updateMutation.isPending && updateMutation.variables?.id === String(slide.id);
            return (
              <SectionCard key={String(slide.id)} title={`Slide ${Number(slide.sortOrder) + 1}`}>
                <form
                  className="space-y-3"
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
                  <LabeledInput label="Headline">
                    <input name="headline" defaultValue={String(slide.headline)} className={inputClass} />
                  </LabeledInput>
                  <LabeledInput label="Accent line">
                    <input name="headlineAccent" defaultValue={String(slide.headlineAccent)} className={inputClass} />
                  </LabeledInput>
                  <LabeledInput label="Subline">
                    <textarea name="subline" defaultValue={String(slide.subline)} rows={2} className={inputClass} />
                  </LabeledInput>
                  <LabeledInput label="Image slot key" hint="e.g. heroRestaurant">
                    <input name="imageKey" defaultValue={String(slide.imageKey ?? '')} className={`${inputClass} font-mono`} />
                  </LabeledInput>
                  <Button type="submit" size="sm" loading={saving}>
                    Save slide
                  </Button>
                </form>
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
