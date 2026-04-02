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
    name: z.string().trim().min(2, 'Group adı en az 2 karakter olmalıdır.').max(256, 'Group adı en fazla 256 karakter olabilir.'),
    bottomLabel: z.string().trim().max(256, 'Bottom label en fazla 256 karakter olabilir.'),
    logoAssetId: z.string().uuid('Geçerli bir logo asset id girin.'),
    badgeType: z.enum(['none', 'emoji', 'svg']).default('none'),
    badgeValue: z.string().trim().max(1024, 'Badge değeri en fazla 1024 karakter olabilir.').optional(),
    storyGroupSetIds: z.array(z.string().uuid('Geçerli bir Story Bar id girin.')).default([]),
  })
  .superRefine((values, context) => {
    if (values.badgeType !== 'none' && !values.badgeValue?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['badgeValue'],
        message: 'Badge tipi seçildiyse badge değeri zorunludur.',
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
            {mode === 'edit' ? 'Story Group düzenleme' : mode === 'copy' ? 'Story Group kopyası' : 'Yeni Story Group'}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Group root kaydı oluşturulur. Logo asset zorunludur; badge tamamen opsiyoneldir ve varsa
            yalnızca `emoji` veya `svg` olabilir.
          </p>
        </div>

        {generalError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive">
            {generalError}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="name">Group adı</Label>
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
              Story bar altında görünecek kısa label. Boş bırakılabilir.
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
              Kare group logo asseti seçin. İsterseniz mevcut kayıtlardan seçebilir, URL ile ekleyebilir veya bilgisayardan yükleyebilirsiniz.
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
              Group hangi Story Bar&apos;larda referanslanacaksa burada seçin. Bu seçim Story Bar composition etkisidir.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="badgeType">Badge tipi</Label>
          <Controller
            control={control}
            name="badgeType"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id="badgeType">
                  <SelectValue placeholder="Badge tipi seçin" />
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
          <Label htmlFor="badgeValue">Badge değeri</Label>
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
              Badge tipi `none` ise bu alan gönderilmez.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border/60 px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
        <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="outline">
          Vazgeç
        </Button>
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting
            ? mode === 'edit'
              ? 'Kaydediliyor...'
              : 'Oluşturuluyor...'
            : mode === 'edit'
              ? 'Değişiklikleri kaydet'
              : mode === 'copy'
                ? 'Kopyayı oluştur'
                : 'Story Group oluştur'}
        </Button>
      </div>
    </form>
  );
}
