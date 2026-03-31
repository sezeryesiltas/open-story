'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@open-story/ui/components/button';
import { Input } from '@open-story/ui/components/input';
import { Label } from '@open-story/ui/components/label';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const formSchema = z.object({
  name: z.string().min(2, 'Placement adı en az 2 karakter olmalıdır.'),
  placementKey: z
    .string()
    .min(3, 'placement_key en az 3 karakter olmalıdır.')
    .regex(/^[a-z0-9_]+$/, 'Sadece küçük harf, sayı ve alt çizgi kullanılabilir.')
});

type FormValues = z.infer<typeof formSchema>;

export function CreatePlacementForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful }
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      placementKey: ''
    }
  });

  const onSubmit = async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="name">Placement adı</Label>
        <Input id="name" placeholder="Home Top Story Bar" {...register('name')} />
        {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="placementKey">Placement key</Label>
        <Input id="placementKey" placeholder="home_top_story_bar" {...register('placementKey')} />
        {errors.placementKey ? (
          <p className="text-sm text-destructive">{errors.placementKey.message}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Kaydediliyor...' : 'Placement oluştur'}
        </Button>
        {isSubmitSuccessful ? <p className="text-sm text-emerald-600">Taslak kayıt başarılı.</p> : null}
      </div>
    </form>
  );
}
