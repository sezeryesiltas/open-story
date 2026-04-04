'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { appVersionSchema, userSegmentSchema } from '@open-story/contracts';
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
import { Textarea } from '@open-story/ui/components/textarea';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

type PlacementOption = {
  id: string;
  name: string;
  placementKey: string;
};

const formSchema = z
  .object({
    name: z.string().trim().min(2, 'Story Bar adı en az 2 karakter olmalıdır.'),
    placementId: z.string().trim().min(1, 'Bir placement seçin.'),
    isFallback: z.boolean().default(false),
    iosEnabled: z.boolean().default(false),
    iosMinAppVersion: z.string().trim().optional(),
    androidEnabled: z.boolean().default(false),
    androidMinAppVersion: z.string().trim().optional(),
    userSegmentsText: z.string().optional(),
  })
  .superRefine((values, context) => {
    if (values.isFallback) {
      return;
    }

    if (values.iosEnabled) {
      const result = appVersionSchema.safeParse(values.iosMinAppVersion);
      if (!result.success) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['iosMinAppVersion'],
          message: 'iOS min app version `major.minor.patch` formatında olmalıdır.',
        });
      }
    }

    if (values.androidEnabled) {
      const result = appVersionSchema.safeParse(values.androidMinAppVersion);
      if (!result.success) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['androidMinAppVersion'],
          message: 'Android min app version `major.minor.patch` formatında olmalıdır.',
        });
      }
    }

    const segments = parseUserSegments(values.userSegmentsText);

    if (segments.length > 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['userSegmentsText'],
        message: 'En fazla 100 segment girilebilir.',
      });
      return;
    }

    for (const segment of segments) {
      const result = userSegmentSchema.safeParse(segment);
      if (!result.success) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['userSegmentsText'],
          message: 'Her segment boş olmayan ve en fazla 64 karakterlik bir değer olmalıdır.',
        });
        return;
      }
    }
  });

export type StoryGroupSetFormValues = z.infer<typeof formSchema>;

export type StoryGroupSetSubmitValues = {
  name: string;
  placementId: string;
  isFallback: boolean;
  platformTargets: Array<{
    platform: 'ios' | 'android';
    minAppVersion: string;
  }>;
  userSegments: string[];
};

export type StoryGroupSetFormSubmitResult =
  | {
      fieldErrors?: Partial<Record<keyof StoryGroupSetFormValues, string>>;
    }
  | void;

function parseUserSegments(value?: string): string[] {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((segment) => segment.trim())
        .filter(Boolean),
    ),
  );
}

function toSubmitValues(values: StoryGroupSetFormValues): StoryGroupSetSubmitValues {
  const platformTargets: StoryGroupSetSubmitValues['platformTargets'] = [];

  if (!values.isFallback && values.iosEnabled && values.iosMinAppVersion?.trim()) {
    platformTargets.push({
      platform: 'ios',
      minAppVersion: values.iosMinAppVersion.trim(),
    });
  }

  if (!values.isFallback && values.androidEnabled && values.androidMinAppVersion?.trim()) {
    platformTargets.push({
      platform: 'android',
      minAppVersion: values.androidMinAppVersion.trim(),
    });
  }

  return {
    name: values.name.trim(),
    placementId: values.placementId,
    isFallback: values.isFallback,
    platformTargets,
    userSegments: values.isFallback ? [] : parseUserSegments(values.userSegmentsText),
  };
}

export function StoryGroupSetForm({
  mode,
  placements,
  initialValues,
  generalError,
  onCancel,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  placements: PlacementOption[];
  initialValues: StoryGroupSetFormValues;
  generalError?: string | null;
  onCancel: () => void;
  onSubmit: (
    values: StoryGroupSetSubmitValues,
  ) => Promise<StoryGroupSetFormSubmitResult> | StoryGroupSetFormSubmitResult;
}) {
  const {
    control,
    register,
    reset,
    setError,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StoryGroupSetFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const isFallback = watch('isFallback');

  const placementOptions = useMemo(() => {
    if (!initialValues.placementId || placements.some((placement) => placement.id === initialValues.placementId)) {
      return placements;
    }

    return [
      {
        id: initialValues.placementId,
        name: 'Unknown placement',
        placementKey: 'missing_placement',
      },
      ...placements,
    ];
  }, [initialValues.placementId, placements]);

  const handleFormSubmit = handleSubmit(async (values) => {
    const result = await onSubmit(toSubmitValues(values));

    if (result?.fieldErrors) {
      for (const [fieldName, message] of Object.entries(result.fieldErrors)) {
        if (!message) {
          continue;
        }

        setError(fieldName as keyof StoryGroupSetFormValues, {
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
            {mode === 'create' ? 'Yeni Story Bar' : 'Story Bar düzenleme'}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Targeting yalnızca Story Bar seviyesinde yaşar. Group composition ayrı içerik akışlarıyla
            yönetilir; bu form sadece placement ve targeting kurallarını düzenler.
          </p>
        </div>

        {generalError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive">
            {generalError}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="name">Story Bar adı</Label>
          <Input id="name" placeholder="Home Top Default Story Bar" {...register('name')} />
          {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="placementId">Placement</Label>
          <Controller
            control={control}
            name="placementId"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value || undefined}>
                <SelectTrigger id="placementId">
                  <SelectValue placeholder="Placement seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {placementOptions.map((placement) => (
                      <SelectItem key={placement.id} value={placement.id}>
                        {placement.name} ({placement.placementKey})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          />
          {errors.placementId ? (
            <p className="text-sm text-destructive">{errors.placementId.message}</p>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              Story Bar her zaman tek bir placement altında çözülür.
            </p>
          )}
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-4">
          <input
            className="mt-1 h-4 w-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
            type="checkbox"
            {...register('isFallback')}
          />
          <div className="space-y-1">
            <p className="text-sm font-medium">Fallback Story Bar</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Bu Story Bar yalnızca hiçbir normal targeting eşleşmediğinde kullanılmalıdır.
            </p>
          </div>
        </label>

        <div className="space-y-4 rounded-xl border border-border/60 p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Platform targets</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Fallback Story Bar için platform hedefleri devre dışıdır. Normal Story Bar'larda
              platform başına tek min app version girin.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium" htmlFor="iosEnabled">
                    iOS
                  </Label>
                  <p className="text-xs leading-5 text-muted-foreground">Örn. 5.2.0</p>
                </div>

                <Controller
                  control={control}
                  name="iosEnabled"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      disabled={isFallback}
                      id="iosEnabled"
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor="iosMinAppVersion">Min app version</Label>
                <Input
                  id="iosMinAppVersion"
                  className="font-mono"
                  disabled={isFallback}
                  placeholder="5.2.0"
                  {...register('iosMinAppVersion')}
                />
                {errors.iosMinAppVersion ? (
                  <p className="text-sm text-destructive">{errors.iosMinAppVersion.message}</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium" htmlFor="androidEnabled">
                    Android
                  </Label>
                  <p className="text-xs leading-5 text-muted-foreground">Örn. 8.1.0</p>
                </div>

                <Controller
                  control={control}
                  name="androidEnabled"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      disabled={isFallback}
                      id="androidEnabled"
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor="androidMinAppVersion">Min app version</Label>
                <Input
                  id="androidMinAppVersion"
                  className="font-mono"
                  disabled={isFallback}
                  placeholder="8.1.0"
                  {...register('androidMinAppVersion')}
                />
                {errors.androidMinAppVersion ? (
                  <p className="text-sm text-destructive">{errors.androidMinAppVersion.message}</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="userSegmentsText">User segments</Label>
          <Textarea
            disabled={isFallback}
            id="userSegmentsText"
            placeholder={'vip, beta\nloyal'}
            {...register('userSegmentsText')}
          />
          {errors.userSegmentsText ? (
            <p className="text-sm text-destructive">{errors.userSegmentsText.message}</p>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              Virgül veya satır sonu ile ayırın. Segment yoksa Story Bar segmentless/default davranır.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border/60 px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
        <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="outline">
          Vazgeç
        </Button>
        <Button disabled={isSubmitting || placements.length === 0} type="submit">
          {isSubmitting
            ? mode === 'create'
              ? 'Oluşturuluyor...'
              : 'Kaydediliyor...'
            : mode === 'create'
              ? 'Story Bar oluştur'
              : 'Değişiklikleri kaydet'}
        </Button>
      </div>
    </form>
  );
}
