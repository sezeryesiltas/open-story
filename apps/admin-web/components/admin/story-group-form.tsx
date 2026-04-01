'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@open-story/ui/components/button';
import { Input } from '@open-story/ui/components/input';
import { Label } from '@open-story/ui/components/label';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const formSchema = z
  .object({
    name: z.string().trim().min(2, 'Group adı en az 2 karakter olmalıdır.').max(256, 'Group adı en fazla 256 karakter olabilir.'),
    logoAssetId: z.string().uuid('Geçerli bir logo asset id girin.'),
    badgeType: z.enum(['none', 'emoji', 'svg']).default('none'),
    badgeValue: z.string().trim().max(1024, 'Badge değeri en fazla 1024 karakter olabilir.').optional(),
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
  logo_asset_id: string;
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
    logo_asset_id: values.logoAssetId,
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
  initialValues,
  generalError,
  onCancel,
  onSubmit,
}: {
  initialValues: StoryGroupFormValues;
  generalError?: string | null;
  onCancel: () => void;
  onSubmit: (
    values: StoryGroupFormSubmitValues,
  ) => Promise<StoryGroupFormSubmitResult> | StoryGroupFormSubmitResult;
}) {
  const {
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
          <p className="text-sm font-medium">Yeni Story Group</p>
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
          <Label htmlFor="logoAssetId">Logo asset id</Label>
          <Input id="logoAssetId" placeholder="00000000-0000-0000-0000-000000000000" {...register('logoAssetId')} />
          {errors.logoAssetId ? (
            <p className="text-sm text-destructive">{errors.logoAssetId.message}</p>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              Asset picker henüz ekli değil. Şimdilik mevcut square logo asset UUID değerini manuel girin.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="badgeType">Badge tipi</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            id="badgeType"
            {...register('badgeType')}
          >
            <option value="none">Badge yok</option>
            <option value="emoji">Emoji</option>
            <option value="svg">SVG</option>
          </select>
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
          {isSubmitting ? 'Oluşturuluyor...' : 'Story Group oluştur'}
        </Button>
      </div>
    </form>
  );
}
