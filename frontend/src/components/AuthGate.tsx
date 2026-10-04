"use client";

import { createContext, useContext, useEffect, useState } from "react";
import AuthScreen from "./AuthScreen";
import { getMe, signOut as signOutRequest } from "@/lib/api";

interface Session {
  email: string;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

/** The signed-in user and sign-out action; only valid inside AuthGate's children. */
export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside AuthGate");
  return session;
}

type State = { status: "loading" } | { status: "signedOut" } | { status: "signedIn"; email: string };

/** Shows the sign in / sign up screen until the server confirms a session cookie. */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    getMe().then(
      ({ email }) => setState({ status: "signedIn", email }),
      () => setState({ status: "signedOut" }),
    );
  }, []);

  if (state.status === "loading") return null;
  if (state.status === "signedOut") {
    return <AuthScreen onAuthenticated={(email) => setState({ status: "signedIn", email })} />;
  }
  const signOut = async () => {
    await signOutRequest();
    setState({ status: "signedOut" });
  };
  return <SessionContext value={{ email: state.email, signOut }}>{children}</SessionContext>;
}
