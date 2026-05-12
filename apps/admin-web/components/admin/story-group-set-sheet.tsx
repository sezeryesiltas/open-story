'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@open-story/ui/components/sheet';

import {
  StoryGroupSetForm,
  StoryGroupSetFormSubmitResult,
  StoryGroupSetFormValues,
  StoryGroupSetSubmitValues,
} from '@/components/admin/story-group-set-form';

type PlacementOption = {
  id: string;
  name: string;
  placementKey: string;
};

export function StoryGroupSetSheet({
  open,
  mode,
  placements,
  initialValues,
  generalError,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  placements: PlacementOption[];
  initialValues: StoryGroupSetFormValues;
  generalError?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    values: StoryGroupSetSubmitValues,
  ) => Promise<StoryGroupSetFormSubmitResult> | StoryGroupSetFormSubmitResult;
}) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="p-0">
        <SheetHeader>
          <SheetTitle>
            {mode === 'create' ? 'Create new Story Bar' : 'Edit Story Bar'}
          </SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? 'Add a new Story Bar.'
              : 'Update the selected Story Bar details.'}
          </SheetDescription>
        </SheetHeader>

        <StoryGroupSetForm
          generalError={generalError}
          initialValues={initialValues}
          mode={mode}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
          placements={placements}
        />
      </SheetContent>
    </Sheet>
  );
}
