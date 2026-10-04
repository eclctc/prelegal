"use client";

import { useId, useState } from "react";
import { signIn, signUp } from "@/lib/api";

const input =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#209dd7] focus:outline-none focus:ring-1 focus:ring-[#209dd7]";

type Mode = "signIn" | "signUp";

/** Sign in or create an account; reports the signed-in email on success. */
export default function AuthScreen({ onAuthenticated }: { onAuthenticated: (email: string) => void }) {
  const id = useId();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const creating = mode === "signUp";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await (creating ? signUp : signIn)(email, password);
      onAuthenticated(result.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode(creating ? "signIn" : "signUp");
    setError(null);
  };

  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-5 rounded-lg border border-slate-200 border-t-4 border-t-[#ecad0a] bg-white p-8 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#032147]">Prelegal</h1>
          <p className="mt-1 text-sm text-[#888888]">
            {creating ? "Create an account to draft and keep your legal agreements." : "Sign in to draft your legal agreements."}
          </p>
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-email`} className="block text-sm font-medium text-[#032147]">Email</label>
          <input id={`${id}-email`} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-password`} className="block text-sm font-medium text-[#032147]">Password</label>
          <input
            id={`${id}-password`}
            type="password"
            required
            minLength={creating ? 8 : undefined}
            autoComplete={creating ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={input}
          />
          {creating && <p className="text-xs text-[#888888]">At least 8 characters.</p>}
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-[#753991] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {creating ? "Create account" : "Sign in"}
        </button>
        <p className="text-center text-sm text-[#888888]">
          {creating ? "Already have an account?" : "New to Prelegal?"}{" "}
          <button type="button" onClick={switchMode} className="font-medium text-[#209dd7] underline">
            {creating ? "Sign in" : "Create an account"}
          </button>
        </p>
      </form>
    </main>
  );
}
