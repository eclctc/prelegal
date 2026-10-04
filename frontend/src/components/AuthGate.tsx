"use client";

import { useSyncExternalStore } from "react";
import LoginScreen from "./LoginScreen";

export const SESSION_KEY = "prelegal-signed-in";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function signIn() {
  sessionStorage.setItem(SESSION_KEY, "true");
  listeners.forEach((listener) => listener());
}

/** Shows the login screen until the user signs in; the flag lives in sessionStorage. */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const signedIn = useSyncExternalStore(
    subscribe,
    () => sessionStorage.getItem(SESSION_KEY) === "true",
    () => null,
  );

  if (signedIn === null) return null;
  return signedIn ? <>{children}</> : <LoginScreen onLogin={signIn} />;
}
