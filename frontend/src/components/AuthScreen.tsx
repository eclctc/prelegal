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
    <main className="grid flex-1 lg:grid-cols-[1fr_1.1fr]">
      <section className="flex flex-col justify-center gap-6 bg-[#032147] px-8 py-12 text-white sm:px-14">
        <p className="text-3xl font-bold tracking-tight">
          Prelegal<span className="text-[#ecad0a]">.</span>
        </p>
        <h2 className="max-w-md text-2xl font-semibold leading-snug sm:text-3xl">
          Tell the assistant what you need. Get a draft agreement back.
        </h2>
        <p className="max-w-md text-white/75">
          Choose from eleven standard agreements, answer a few plain-language questions, and download the finished
          draft. Everything you create is kept in My documents.
        </p>
      </section>
      <section className="flex items-center justify-center bg-[#f1f4f8] px-4 py-12">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-5 rounded-lg border border-slate-200 bg-white p-8 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#032147]">{creating ? "Create your account" : "Welcome back"}</h1>
          <p className="mt-1 text-sm text-[#888888]">
            {creating ? "Draft and keep your legal agreements in one place." : "Sign in to continue your drafts."}
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
      </section>
    </main>
  );
}
