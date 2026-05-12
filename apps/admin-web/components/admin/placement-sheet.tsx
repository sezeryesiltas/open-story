'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@open-story/ui/components/sheet';

import { PlacementForm, PlacementFormSubmitResult, PlacementFormValues } from '@/components/admin/placement-form';

export function PlacementSheet({
  open,
  mode,
  initialValues,
  generalError,
  onOpenChange,
  onSubmit
}: {
  open: boolean;
  mode: 'create' | 'edit';
  initialValues: PlacementFormValues;
  generalError?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: PlacementFormValues) => Promise<PlacementFormSubmitResult> | PlacementFormSubmitResult;
}) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="p-0">
        <SheetHeader>
          <SheetTitle>{mode === 'create' ? 'Create new placement' : 'Edit placement'}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? 'Add a new placement.'
              : 'Update the selected placement details.'}
          </SheetDescription>
        </SheetHeader>

        <PlacementForm
          generalError={generalError}
          initialValues={initialValues}
          mode={mode}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      </SheetContent>
    </Sheet>
  );
}
