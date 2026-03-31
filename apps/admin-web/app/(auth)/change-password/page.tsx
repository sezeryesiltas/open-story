import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { Input } from '@open-story/ui/components/input';
import { Label } from '@open-story/ui/components/label';

export default function ChangePasswordPage() {
  return (
    <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.03)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_32px_80px_-44px_rgba(0,0,0,1)]">
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
        <CardDescription>
          İlk girişte zorunlu parola yenileme ve admin reset sonrası temporary password değiştirme
          ekranı.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="temporaryPassword">Geçici şifre</Label>
            <Input id="temporaryPassword" type="password" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">Yeni şifre</Label>
            <Input id="newPassword" type="password" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Yeni şifre tekrar</Label>
            <Input id="confirmPassword" type="password" />
          </div>

          <Button className="w-full" type="submit">
            Şifreyi güncelle
          </Button>
        </form>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-sm leading-6 text-slate-400">
          Self-service email reset yoktur. Temporary password üretimi ve reset akışı yalnızca başka
          bir admin tarafından tetiklenir.
        </div>
      </CardContent>
    </Card>
  );
}
