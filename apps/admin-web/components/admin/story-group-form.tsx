'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@open-story/ui/components/button';
import { Input } from '@open-story/ui/components/input';
import { Label } from '@open-story/ui/components/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@open-story/ui/components/select';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { LogoAssetPicker } from '@/components/admin/logo-asset-picker';
import { StoryGroupSetMultiSelect } from '@/components/admin/story-group-set-multi-select';

type StoryGroupSetOption = {
  id: string;
  name: string;
};

const formSchema = z
  .object({
    name: z.string().trim().min(2, 'Group name must be at least 2 characters.').max(256, 'Group name can be at most 256 characters.'),
    bottomLabel: z.string().trim().max(256, 'Bottom label can be at most 256 characters.'),
    logoAssetId: z.string().uuid('Enter a valid logo asset id.'),
    badgeType: z.enum(['none', 'emoji', 'svg']).default('none'),
    badgeValue: z.string().trim().max(1024, 'Badge value can be at most 1024 characters.').optional(),
    storyGroupSetIds: z.array(z.string().uuid('Enter a valid Story Bar id.')).default([]),
  })
  .superRefine((values, context) => {
    if (values.badgeType !== 'none' && !values.badgeValue?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['badgeValue'],
        message: 'Badge value is required when a badge type is selected.',
      });
    }
  });

export type StoryGroupFormValues = z.infer<typeof formSchema>;

export type StoryGroupFormSubmitValues = {
  name: string;
  bottom_label: string | null;
  logo_asset_id: string;
  story_group_set_ids: string[];
  badge: {
    type: 'emoji' | 'svg';
    value: string;
  } | null;
};

export type StoryGroupFormSubmitResult =
  | {
      fieldErrors?: Partial<Record<keyof StoryGroupFormValues, string>>;
    }
  | void;

function toSubmitValues(values: StoryGroupFormValues): StoryGroupFormSubmitValues {
  return {
    name: values.name.trim(),
    bottom_label: values.bottomLabel.trim() || null,
    logo_asset_id: values.logoAssetId,
    story_group_set_ids: values.storyGroupSetIds,
    badge:
      values.badgeType === 'none'
        ? null
        : {
            type: values.badgeType,
            value: values.badgeValue?.trim() ?? '',
          },
  };
}

export function StoryGroupForm({
  mode,
  storyGroupSetOptions,
  initialValues,
  generalError,
  onCancel,
  onSubmit,
}: {
  mode: 'create' | 'edit' | 'copy';
  storyGroupSetOptions: StoryGroupSetOption[];
  initialValues: StoryGroupFormValues;
  generalError?: string | null;
  onCancel: () => void;
  onSubmit: (
    values: StoryGroupFormSubmitValues,
  ) => Promise<StoryGroupFormSubmitResult> | StoryGroupFormSubmitResult;
}) {
  const {
    control,
    register,
    reset,
    setError,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StoryGroupFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const badgeType = watch('badgeType');

  const handleFormSubmit = handleSubmit(async (values) => {
    const result = await onSubmit(toSubmitValues(values));

    if (result?.fieldErrors) {
      for (const [fieldName, message] of Object.entries(result.fieldErrors)) {
        if (!message) {
          continue;
        }

        setError(fieldName as keyof StoryGroupFormValues, {
          type: 'manual',
          message,
        });
      }
    }
  });

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleFormSubmit}>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6 sm:px-8">
        <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
          <p className="text-sm font-medium">
            {mode === 'edit' ? 'Edit Story Group' : mode === 'copy' ? 'Story Group copy' : 'New Story Group'}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Set the Story Group name, logo, and optional badges here.
          </p>
        </div>

        {generalError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive">
            {generalError}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="name">Group name</Label>
          <Input id="name" placeholder="Home Campaign Group" {...register('name')} />
          {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="bottomLabel">Bottom label</Label>
          <Input id="bottomLabel" placeholder="Editor's picks" {...register('bottomLabel')} />
          {errors.bottomLabel ? (
            <p className="text-sm text-destructive">{errors.bottomLabel.message}</p>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              Short label shown under the story bar. This can be left empty.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Logo asset</Label>
          <Controller
            control={control}
            name="logoAssetId"
            render={({ field }) => (
              <LogoAssetPicker
                onChange={(asset) => field.onChange(asset.id)}
                value={field.value}
              />
            )}
          />
          {errors.logoAssetId ? (
            <p className="text-sm text-destructive">{errors.logoAssetId.message}</p>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              Select a square group logo asset. You can choose an existing record, add one by URL, or upload from your computer.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Story Bars</Label>
          <Controller
            control={control}
            name="storyGroupSetIds"
            render={({ field }) => (
              <StoryGroupSetMultiSelect
                onChange={field.onChange}
                options={storyGroupSetOptions}
                value={field.value}
              />
            )}
          />
          {errors.storyGroupSetIds ? (
            <p className="text-sm text-destructive">{errors.storyGroupSetIds.message}</p>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              Select the Story Bars where this group should appear.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="badgeType">Badge type</Label>
          <Controller
            control={control}
            name="badgeType"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id="badgeType">
                  <SelectValue placeholder="Select badge type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">Badge yok</SelectItem>
                    <SelectItem value="emoji">Emoji</SelectItem>
                    <SelectItem value="svg">SVG</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="badgeValue">Badge value</Label>
          <Input
            disabled={badgeType === 'none'}
            id="badgeValue"
            placeholder={badgeType === 'svg' ? '<svg>...</svg>' : '🔥'}
            {...register('badgeValue')}
          />
          {errors.badgeValue ? (
            <p className="text-sm text-destructive">{errors.badgeValue.message}</p>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              You can add an emoji or SVG if needed.
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
            ? mode === 'edit'
              ? 'Saving...'
              : 'Creating...'
            : mode === 'edit'
              ? 'Save changes'
              : mode === 'copy'
                ? 'Create copy'
                : 'Create Story Group'}
        </Button>
      </div>
    </form>
  );
}
