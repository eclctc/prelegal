import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import AuthGate, { SESSION_KEY } from "@/components/AuthGate";

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

const renderGate = () =>
  render(
    <AuthGate>
      <p>protected content</p>
    </AuthGate>,
  );

describe("AuthGate", () => {
  it("shows the login screen and hides content when not signed in", async () => {
    renderGate();
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });

  it("accepts any input, including empty, and reveals the content", async () => {
    const user = userEvent.setup();
    renderGate();
    await user.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(screen.getByText("protected content")).toBeInTheDocument();
    expect(sessionStorage.getItem(SESSION_KEY)).toBe("true");
  });

  it("skips the login screen when already signed in this session", async () => {
    sessionStorage.setItem(SESSION_KEY, "true");
    renderGate();
    expect(await screen.findByText("protected content")).toBeInTheDocument();
  });
});
