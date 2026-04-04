'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@open-story/ui/components/sheet';

import {
  StoryGroupForm,
  StoryGroupFormSubmitResult,
  StoryGroupFormSubmitValues,
  StoryGroupFormValues,
} from '@/components/admin/story-group-form';

type StoryGroupSetOption = {
  id: string;
  name: string;
};

export function StoryGroupSheet({
  open,
  mode,
  storyGroupSetOptions,
  initialValues,
  generalError,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: 'create' | 'edit' | 'copy';
  storyGroupSetOptions: StoryGroupSetOption[];
  initialValues: StoryGroupFormValues;
  generalError?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    values: StoryGroupFormSubmitValues,
  ) => Promise<StoryGroupFormSubmitResult> | StoryGroupFormSubmitResult;
}) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="p-0">
        <SheetHeader>
          <SheetTitle>
            {mode === 'edit'
              ? 'Story Group düzenle'
              : mode === 'copy'
                ? 'Story Group kopyala'
                : 'Yeni Story Group oluştur'}
          </SheetTitle>
          <SheetDescription>
            {mode === 'edit'
              ? 'Seçili Story Group bilgilerini güncelleyin.'
              : mode === 'copy'
                ? 'Seçili Story Group bilgilerini kopyalayın.'
                : 'Yeni bir Story Group ekleyin.'}
          </SheetDescription>
        </SheetHeader>

        <StoryGroupForm
          generalError={generalError}
          initialValues={initialValues}
          mode={mode}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
          storyGroupSetOptions={storyGroupSetOptions}
        />
      </SheetContent>
    </Sheet>
  );
}
