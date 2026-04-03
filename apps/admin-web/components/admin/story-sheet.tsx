'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@open-story/ui/components/sheet';

import {
  StoryForm,
  StoryFormSubmitResult,
  StoryFormSubmitValues,
  StoryFormValues,
} from '@/components/admin/story-form';

type StoryGroupOption = {
  id: string;
  name: string;
  storyCount: number;
  archiveState: 'active' | 'archived';
  publishState: 'published' | 'unpublished';
};

export function StorySheet({
  open,
  mode,
  storyGroups,
  initialValues,
  generalError,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  storyGroups: StoryGroupOption[];
  initialValues: StoryFormValues;
  generalError?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    values: StoryFormSubmitValues,
  ) => Promise<StoryFormSubmitResult> | StoryFormSubmitResult;
}) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="p-0">
        <SheetHeader>
          <SheetTitle>{mode === 'edit' ? 'Story düzenle' : 'Yeni Story oluştur'}</SheetTitle>
          <SheetDescription>
            {mode === 'edit'
              ? 'Media, CTA ve group içi sıra alanlarını draft düzeyinde güncelleyin. Move ve reorder işlemleri parent group için republish etkisi yaratır.'
              : 'Yeni bir story root kaydı oluşturun. Story tek bir group altında yaşar; media-first modelde image veya video seçilir.'}
          </SheetDescription>
        </SheetHeader>

        <StoryForm
          generalError={generalError}
          initialValues={initialValues}
          mode={mode}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
          storyGroups={storyGroups}
        />
      </SheetContent>
    </Sheet>
  );
}
