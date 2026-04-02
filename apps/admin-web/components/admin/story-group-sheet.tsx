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
              ? 'Seçili Story Group için name, bottom label, logo ve badge alanlarını güncelleyin.'
              : mode === 'copy'
                ? 'Seçili Story Group verilerini kopyalayarak yeni bir root kayıt oluşturun.'
                : 'Story bar giriş noktası için yeni bir group root kaydı tanımlayın. İlk sürümde create akışı bottom label, logo asset, badge ve boş story listesi ile başlar.'}
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
