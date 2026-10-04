"use client";

import { useId } from "react";

const input =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#209dd7] focus:outline-none focus:ring-1 focus:ring-[#209dd7]";

/** Placeholder sign-in form. Any input is accepted; real authentication comes later. */
export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const id = useId();

  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onLogin();
        }}
        className="w-full max-w-sm space-y-5 rounded-lg border border-slate-200 border-t-4 border-t-[#ecad0a] bg-white p-8 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#032147]">Prelegal</h1>
          <p className="mt-1 text-sm text-[#888888]">Sign in to draft your legal agreements.</p>
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-email`} className="block text-sm font-medium text-[#032147]">Email</label>
          <input id={`${id}-email`} type="email" className={input} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-password`} className="block text-sm font-medium text-[#032147]">Password</label>
          <input id={`${id}-password`} type="password" className={input} />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-[#753991] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
