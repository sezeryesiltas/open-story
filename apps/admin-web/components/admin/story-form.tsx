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
import { Switch } from '@open-story/ui/components/switch';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { StoryAssetPicker } from '@/components/admin/story-asset-picker';

type StoryGroupOption = {
  id: string;
  name: string;
  storyCount: number;
  archiveState: 'active' | 'archived';
  publishState: 'published' | 'unpublished';
};

const formSchema = z
  .object({
    name: z.string().trim().min(2, 'Story name must be at least 2 characters.').max(256, 'Story name can be at most 256 characters.'),
    groupId: z.string().uuid('Select a Story Group.'),
    position: z.string().trim().regex(/^[1-9]\d*$/, 'Select a valid order position.'),
    mediaType: z.enum(['image', 'video']).default('image'),
    assetId: z.string().uuid('Story media asset is required.'),
    posterAssetId: z.string().optional(),
    imageDurationSeconds: z.string().trim().optional(),
    hasCta: z.boolean().default(false),
    ctaLabel: z.string().trim().max(64, 'CTA label can be at most 64 characters.').optional(),
    ctaType: z.enum(['url', 'deeplink']).default('url'),
    ctaValue: z.string().trim().max(2048, 'CTA target value can be at most 2048 characters.').optional(),
  })
  .superRefine((values, context) => {
    if (values.mediaType === 'video') {
      if (!values.posterAssetId?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['posterAssetId'],
          message: 'A poster is required for video stories.',
        });
      }

      if (values.imageDurationSeconds?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['imageDurationSeconds'],
          message: 'Image duration override only applies to image stories.',
        });
      }
    }

    if (values.mediaType === 'image' && values.imageDurationSeconds?.trim()) {
      const parsedValue = Number(values.imageDurationSeconds);

      if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['imageDurationSeconds'],
          message: 'Image duration must be a positive integer in seconds.',
        });
      }
    }

    if (!values.hasCta) {
      return;
    }

    if (!values.ctaLabel?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ctaLabel'],
        message: 'CTA label is required when CTA is active.',
      });
    }

    if (!values.ctaValue?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ctaValue'],
        message: 'CTA target value is required when CTA is active.',
      });
    }
  });

export type StoryFormValues = z.infer<typeof formSchema>;

export type StoryFormSubmitValues = {
  name: string;
  group_id: string;
  position: number;
  media_type: 'image' | 'video';
  asset_id: string;
  poster_asset_id: string | null;
  image_duration_ms: number | null;
  cta: {
    label: string;
    type: 'url' | 'deeplink';
    value: string;
  } | null;
};

export type StoryFormSubmitResult =
  | {
      fieldErrors?: Partial<Record<keyof StoryFormValues, string>>;
    }
  | void;

function toSubmitValues(values: StoryFormValues): StoryFormSubmitValues {
  return {
    name: values.name.trim(),
    group_id: values.groupId,
    position: Number(values.position),
    media_type: values.mediaType,
    asset_id: values.assetId,
    poster_asset_id: values.mediaType === 'video' ? values.posterAssetId?.trim() ?? null : null,
    image_duration_ms:
      values.mediaType === 'image' && values.imageDurationSeconds?.trim()
        ? Number(values.imageDurationSeconds) * 1000
        : null,
    cta:
      values.hasCta
        ? {
            label: values.ctaLabel?.trim() ?? '',
            type: values.ctaType,
            value: values.ctaValue?.trim() ?? '',
          }
        : null,
  };
}

export function StoryForm({
  mode,
  storyGroups,
  initialValues,
  generalError,
  onCancel,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  storyGroups: StoryGroupOption[];
  initialValues: StoryFormValues;
  generalError?: string | null;
  onCancel: () => void;
  onSubmit: (
    values: StoryFormSubmitValues,
  ) => Promise<StoryFormSubmitResult> | StoryFormSubmitResult;
}) {
  const {
    control,
    register,
    reset,
    setError,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StoryFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const selectedGroupId = watch('groupId');
  const selectedMediaType = watch('mediaType');
  const hasCta = watch('hasCta');
  const positionValue = watch('position');

  const storyGroupOptions = useMemo(() => {
    if (!initialValues.groupId || storyGroups.some((storyGroup) => storyGroup.id === initialValues.groupId)) {
      return storyGroups;
    }

    return [
      {
        id: initialValues.groupId,
        name: 'Unknown Story Group',
        storyCount: 0,
        archiveState: 'active' as const,
        publishState: 'unpublished' as const,
      },
      ...storyGroups,
    ];
  }, [initialValues.groupId, storyGroups]);

  const selectedGroup = useMemo(
    () => storyGroupOptions.find((storyGroup) => storyGroup.id === selectedGroupId) ?? null,
    [selectedGroupId, storyGroupOptions],
  );

  const positionOptions = useMemo(() => {
    if (!selectedGroup) {
      return [];
    }

    const baseCount = selectedGroup.storyCount;
    const isEditingCurrentGroup = mode === 'edit' && selectedGroup.id === initialValues.groupId;
    const rawMax = baseCount + (isEditingCurrentGroup ? 0 : 1);
    const currentPosition = Number(positionValue || initialValues.position || '1');
    const maxPosition = Math.max(rawMax, Number.isFinite(currentPosition) ? currentPosition : 1, 1);

    return Array.from({ length: maxPosition }, (_, index) => String(index + 1));
  }, [initialValues.groupId, initialValues.position, mode, positionValue, selectedGroup]);

  const handleFormSubmit = handleSubmit(async (values) => {
    const result = await onSubmit(toSubmitValues(values));

    if (result?.fieldErrors) {
      for (const [fieldName, message] of Object.entries(result.fieldErrors)) {
        if (!message) {
          continue;
        }

        setError(fieldName as keyof StoryFormValues, {
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
          <p className="text-sm font-medium">{mode === 'edit' ? 'Edit Story' : 'Create New Story'}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Edit the Story name, group, media, and CTA details here.
          </p>
        </div>

        {generalError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive">
            {generalError}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="storyName">Story name</Label>
          <Input id="storyName" placeholder="Spring Launch Story" {...register('name')} />
          {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="storyGroupId">Story Group</Label>
            <Controller
              control={control}
              name="groupId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger id="storyGroupId">
                    <SelectValue placeholder="Select a Story Group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {storyGroupOptions.map((storyGroup) => (
                        <SelectItem
                          disabled={storyGroup.archiveState === 'archived'}
                          key={storyGroup.id}
                          value={storyGroup.id}
                        >
                          {storyGroup.archiveState === 'archived'
                            ? `${storyGroup.name} (Archived)`
                            : storyGroup.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.groupId ? (
              <p className="text-sm text-destructive">{errors.groupId.message}</p>
            ) : selectedGroup ? (
              <p className="text-xs leading-5 text-muted-foreground">
                Contains {selectedGroup.storyCount} stories. {selectedGroup.archiveState === 'archived' ? 'This group is archived.' : 'This group is active.'}
              </p>
            ) : (
              <p className="text-xs leading-5 text-muted-foreground">
                Select a Story Group for the story.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="storyPosition">Order within group</Label>
            <Controller
              control={control}
              name="position"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger id="storyPosition">
                    <SelectValue placeholder="Select order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {positionOptions.map((position) => (
                        <SelectItem key={position} value={position}>
                          {position}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.position ? (
              <p className="text-sm text-destructive">{errors.position.message}</p>
            ) : (
              <p className="text-xs leading-5 text-muted-foreground">
                `1` is the top position.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="storyMediaType">Media type</Label>
          <Controller
            control={control}
            name="mediaType"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id="storyMediaType">
                  <SelectValue placeholder="Select media type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-2">
          <Label>{selectedMediaType === 'video' ? 'Video asset' : 'Image asset'}</Label>
          <Controller
            control={control}
            name="assetId"
            render={({ field }) => (
              <StoryAssetPicker
                assetType={selectedMediaType === 'video' ? 'story_video' : 'story_image'}
                onChange={(asset) => field.onChange(asset.id)}
                value={field.value}
              />
            )}
          />
          {errors.assetId ? (
            <p className="text-sm text-destructive">{errors.assetId.message}</p>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              {selectedMediaType === 'video'
                ? 'Select a video with a suitable size.'
                : 'Select an image with a suitable size.'}
            </p>
          )}
        </div>

        {selectedMediaType === 'video' ? (
          <div className="space-y-2">
            <Label>Video poster</Label>
            <Controller
              control={control}
              name="posterAssetId"
              render={({ field }) => (
                <StoryAssetPicker assetType="story_poster" onChange={(asset) => field.onChange(asset.id)} value={field.value ?? ''} />
              )}
            />
            {errors.posterAssetId ? (
              <p className="text-sm text-destructive">{errors.posterAssetId.message}</p>
            ) : (
              <p className="text-xs leading-5 text-muted-foreground">
                Select a poster image for the video.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="imageDurationSeconds">Image duration override (seconds)</Label>
            <Input
              id="imageDurationSeconds"
              inputMode="numeric"
              placeholder="5"
              type="number"
              {...register('imageDurationSeconds')}
            />
            {errors.imageDurationSeconds ? (
              <p className="text-sm text-destructive">{errors.imageDurationSeconds.message}</p>
            ) : (
              <p className="text-xs leading-5 text-muted-foreground">
                Leave empty to use 5 seconds.
              </p>
            )}
          </div>
        )}

        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">CTA</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Fill all fields to add a CTA.
              </p>
            </div>
            <Controller
              control={control}
              name="hasCta"
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>
        </div>

        {hasCta ? (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ctaLabel">CTA label</Label>
              <Input id="ctaLabel" placeholder="Learn more" {...register('ctaLabel')} />
              {errors.ctaLabel ? <p className="text-sm text-destructive">{errors.ctaLabel.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ctaType">CTA target type</Label>
              <Controller
                control={control}
                name="ctaType"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="ctaType">
                      <SelectValue placeholder="Select CTA type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="url">URL</SelectItem>
                        <SelectItem value="deeplink">Deeplink</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ctaValue">CTA target value</Label>
              <Input
                id="ctaValue"
                placeholder={watch('ctaType') === 'deeplink' ? 'app://campaign/spring-launch' : 'https://example.com/campaign'}
                {...register('ctaValue')}
              />
              {errors.ctaValue ? (
                <p className="text-sm text-destructive">{errors.ctaValue.message}</p>
              ) : (
                <p className="text-xs leading-5 text-muted-foreground">
                  Enter a valid URL or deeplink.
                </p>
              )}
            </div>
          </div>
        ) : null}
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
              : 'Create Story'}
        </Button>
      </div>
    </form>
  );
}
