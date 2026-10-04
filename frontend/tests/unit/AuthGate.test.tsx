import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuthGate, { useSession } from "@/components/AuthGate";
import { ApiError, getMe, signIn, signOut, signUp } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getMe: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}));

const Protected = () => {
  const { email, signOut: out } = useSession();
  return <button onClick={out}>protected for {email}</button>;
};
const renderGate = () =>
  render(
    <AuthGate>
      <Protected />
    </AuthGate>,
  );

beforeEach(() => {
  vi.mocked(getMe).mockResolvedValue({ email: null });
  vi.mocked(signOut).mockResolvedValue();
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("AuthGate", () => {
  it("shows the sign in screen when there is no session", async () => {
    renderGate();
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText(/protected for/)).toBeNull();
  });

  it("skips the sign in screen when the server confirms a session", async () => {
    vi.mocked(getMe).mockResolvedValue({ email: "ann@example.com" });
    renderGate();
    expect(await screen.findByText("protected for ann@example.com")).toBeInTheDocument();
  });

  it("signs in with the entered credentials", async () => {
    vi.mocked(signIn).mockResolvedValue({ email: "ann@example.com" });
    const user = userEvent.setup();
    renderGate();
    await user.type(await screen.findByLabelText("Email"), "ann@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("protected for ann@example.com")).toBeInTheDocument();
    expect(signIn).toHaveBeenCalledWith("ann@example.com", "correct horse");
  });

  it("shows the server's error and stays on the screen when sign in fails", async () => {
    vi.mocked(signIn).mockRejectedValue(new ApiError(401, "Invalid email or password"));
    const user = userEvent.setup();
    renderGate();
    await user.type(await screen.findByLabelText("Email"), "ann@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
  });

  it("creates an account from the sign up mode", async () => {
    vi.mocked(signUp).mockResolvedValue({ email: "new@example.com" });
    const user = userEvent.setup();
    renderGate();
    await user.click(await screen.findByRole("button", { name: "Create an account" }));
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "long enough pw");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("protected for new@example.com")).toBeInTheDocument();
    expect(signUp).toHaveBeenCalledWith("new@example.com", "long enough pw");
  });

  it("returns to the sign in screen after signing out", async () => {
    vi.mocked(getMe).mockResolvedValue({ email: "ann@example.com" });
    const user = userEvent.setup();
    renderGate();
    await user.click(await screen.findByText("protected for ann@example.com"));
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(signOut).toHaveBeenCalled();
  });
});
