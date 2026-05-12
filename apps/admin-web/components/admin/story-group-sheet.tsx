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
              ? 'Edit Story Group'
              : mode === 'copy'
                ? 'Copy Story Group'
                : 'Create new Story Group'}
          </SheetTitle>
          <SheetDescription>
            {mode === 'edit'
              ? 'Update the selected Story Group details.'
              : mode === 'copy'
                ? 'Copy the selected Story Group details.'
                : 'Add a new Story Group.'}
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
