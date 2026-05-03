import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label, FieldError, FieldHelp } from "@/components/ui/Label";
import { useAuth } from "@/contexts/AuthContext";
import { isValidPhone, normalizePhone } from "@/lib/phone";

export function LoginPage() {
  const { signIn, session, profile } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session && profile) {
      navigate(profile.role === "owner" ? "/admin" : "/shop", {
        replace: true,
      });
    }
  }, [session, profile, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isValidPhone(phone)) {
      setError("Enter a valid 10-digit Indian phone number.");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    setLoading(true);
    try {
      await signIn(normalizePhone(phone), password);
      // Redirect handled by useEffect once profile loads.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-slate-100 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">
            W
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Wholesale Credit System
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in with the phone & password your supplier set for you.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div>
            <Label htmlFor="phone" required>
              Phone number
            </Label>
            <Input
              id="phone"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={15}
            />
            <FieldHelp>10-digit number, with or without +91.</FieldHelp>
          </div>

          <div>
            <Label htmlFor="password" required>
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error ? <FieldError message={error} /> : null}

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Sign in
          </Button>

          <p className="text-center text-xs text-slate-500">
            Forgot your password? Ask the owner to reset it for you.
          </p>
        </form>
      </div>
    </div>
  );
}
