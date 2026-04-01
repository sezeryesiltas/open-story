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
  name: z.string().trim().min(2, 'Placement adı en az 2 karakter olmalıdır.'),
  placementKey: z
    .string()
    .trim()
    .min(3, 'placement_key en az 3 karakter olmalıdır.')
    .regex(/^[a-z0-9_]+$/, 'Sadece küçük harf, sayı ve alt çizgi kullanılabilir.'),
  description: z
    .string()
    .trim()
    .max(240, 'Açıklama en fazla 240 karakter olabilir.')
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
          <p className="text-sm font-medium">{mode === 'create' ? 'Yeni placement tanımı' : 'Placement düzenleme'}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Placement render sırasında `placement_key` ile çözülür. Bu alan tekil kalmalı ve SDK init
            aşamasına taşınmamalıdır.
          </p>
        </div>

        {generalError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive">
            {generalError}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="name">Placement adı</Label>
          <Input id="name" placeholder="Home Top Story Bar" {...register('name')} />
          {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="placementKey">Placement key</Label>
          <Input id="placementKey" placeholder="home_top_story_bar" {...register('placementKey')} />
          <p className="text-xs leading-5 text-muted-foreground">
            Küçük harf, sayı ve alt çizgi kullanın. Bu anahtar feed çözümlemesinin public girişidir.
          </p>
          {errors.placementKey ? (
            <p className="text-sm text-destructive">{errors.placementKey.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Açıklama</Label>
          <Textarea
            id="description"
            placeholder="Placement yüzeyinin uygulamada nerede görüneceğini kısa şekilde not edin."
            {...register('description')}
          />
          {errors.description ? (
            <p className="text-sm text-destructive">{errors.description.message}</p>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              Editoryal ekibin placement bağlamını hızla anlaması için kısa ve operasyonel kalın.
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
            ? mode === 'create'
              ? 'Oluşturuluyor...'
              : 'Kaydediliyor...'
            : mode === 'create'
              ? 'Placement oluştur'
              : 'Değişiklikleri kaydet'}
        </Button>
      </div>
    </form>
  );
}
