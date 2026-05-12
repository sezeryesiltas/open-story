'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@open-story/ui/components/button';
import { Input } from '@open-story/ui/components/input';
import { Label } from '@open-story/ui/components/label';
import { Textarea } from '@open-story/ui/components/textarea';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const formSchema = z.object({
  name: z.string().trim().min(2, 'Placement name must be at least 2 characters.'),
  placementKey: z
    .string()
    .trim()
    .min(3, 'Placement key must be at least 3 characters.')
    .regex(/^[a-z0-9_]+$/, 'Use only lowercase letters, numbers, and underscores.'),
  description: z
    .string()
    .trim()
    .max(240, 'Description can be at most 240 characters.')
    .optional()
});

export type PlacementFormValues = z.infer<typeof formSchema>;

export type PlacementFormSubmitResult =
  | {
      fieldErrors?: Partial<Record<keyof PlacementFormValues, string>>;
    }
  | void;

export function PlacementForm({
  mode,
  initialValues,
  generalError,
  onCancel,
  onSubmit
}: {
  mode: 'create' | 'edit';
  initialValues: PlacementFormValues;
  generalError?: string | null;
  onCancel: () => void;
  onSubmit: (values: PlacementFormValues) => Promise<PlacementFormSubmitResult> | PlacementFormSubmitResult;
}) {
  const {
    register,
    reset,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<PlacementFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const handleFormSubmit = handleSubmit(async (values) => {
    const result = await onSubmit(values);

    if (result?.fieldErrors) {
      for (const [fieldName, message] of Object.entries(result.fieldErrors)) {
        if (!message) {
          continue;
        }

        setError(fieldName as keyof PlacementFormValues, {
          type: 'manual',
          message
        });
      }
    }
  });

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleFormSubmit}>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6 sm:px-8">
        <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
          <p className="text-sm font-medium">{mode === 'create' ? 'New placement definition' : 'Edit placement'}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Edit the placement name and key here.
          </p>
        </div>

        {generalError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive">
            {generalError}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="name">Placement name</Label>
          <Input id="name" placeholder="Home Top Story Bar" {...register('name')} />
          {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="placementKey">Placement key</Label>
          <Input id="placementKey" placeholder="home_top_story_bar" {...register('placementKey')} />
          <p className="text-xs leading-5 text-muted-foreground">
            Use lowercase letters, numbers, and underscores.
          </p>
          {errors.placementKey ? (
            <p className="text-sm text-destructive">{errors.placementKey.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Briefly note where this placement surface appears in the app."
            {...register('description')}
          />
          {errors.description ? (
            <p className="text-sm text-destructive">{errors.description.message}</p>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              You can add a short description if needed.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border/60 px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
        <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting
            ? mode === 'create'
              ? 'Creating...'
              : 'Saving...'
            : mode === 'create'
              ? 'Create placement'
              : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
