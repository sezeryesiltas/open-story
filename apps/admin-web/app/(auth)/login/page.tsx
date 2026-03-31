import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { Input } from '@open-story/ui/components/input';
import { Label } from '@open-story/ui/components/label';

export default function LoginPage() {
  return (
    <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.03)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_32px_80px_-44px_rgba(0,0,0,1)]">
      <CardHeader>
        <CardTitle>Login</CardTitle>
        <CardDescription>
          Email + password ile giriş yapılır. Bu ekran auth akışının yerini sabitler.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" placeholder="admin@openstory.dev" type="email" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" placeholder="Temporary password" type="password" />
          </div>

          <Button className="w-full" type="submit">
            Giriş yap
          </Button>
        </form>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-sm leading-6 text-slate-400">
          Başarılı login sonrası kullanıcı dashboard&apos;a geçer. `force_password_change = true`
          olan hesaplar doğrudan `Change Password` akışına yönlendirilir.
        </div>
      </CardContent>
    </Card>
  );
}
