"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ChatPanel from "@/components/ChatPanel";
import { type ChatMessage, mergeFields, OPENING_MESSAGE, sendChat } from "@/lib/chat";
import { buildDocument, defaultForm, localISODate, type NdaForm } from "@/lib/nda";

export default function NdaApp({ standardTerms }: { standardTerms: string }) {
  const [form, setForm] = useState<NdaForm>(() => defaultForm());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openedRef = useRef(false);

  // Today's date depends on the viewer's clock/timezone, so set it after mount rather than
  // during the (prerendered) first render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm((f) => (f.effectiveDate ? f : { ...f, effectiveDate: localISODate() }));
  }, []);

  /** Ask the AI for its next turn given the visible conversation, then apply what it learned. */
  const askAi = async (visible: ChatMessage[]) => {
    setPending(true);
    setError(null);
    try {
      const result = await sendChat([OPENING_MESSAGE, ...visible], form);
      setForm((f) => mergeFields(f, result.fields));
      setMessages([...visible, { role: "assistant", content: result.reply }]);
    } catch {
      setError("Sorry, something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    void askAi([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = (text: string) => {
    const visible: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(visible);
    void askAi(visible);
  };

  const markdown = useMemo(() => buildDocument(standardTerms, form), [standardTerms, form]);

  const download = () => {
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "Mutual-NDA.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[26rem_1fr] print:block print:bg-white">
      <aside className="flex h-[32rem] flex-col gap-4 border-r border-slate-200 bg-white p-6 print:hidden lg:h-screen">
        <div>
          <h1 className="text-xl font-semibold text-[#032147]">Mutual NDA</h1>
          <p className="text-sm text-[#888888]">Chat with the assistant; the agreement fills in as you talk.</p>
        </div>
        <div className="min-h-0 flex-1">
          <ChatPanel messages={messages} pending={pending} error={error} onSend={send} />
        </div>
      </aside>

      <main className="p-4 lg:h-screen lg:overflow-y-auto lg:p-8 print:block print:h-auto print:overflow-visible print:p-0">
        <div className="mx-auto mb-4 flex max-w-3xl justify-end gap-2 print:hidden">
          <button onClick={download} className="rounded-md bg-[#753991] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            Download (.md)
          </button>
          <button onClick={() => window.print()} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100">
            Print / Save as PDF
          </button>
        </div>
        <article aria-label="Agreement preview" className="nda mx-auto max-w-3xl rounded-lg bg-white p-5 shadow-sm sm:p-10 print:max-w-none print:shadow-none">
          <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
        </article>
        <footer className="mx-auto mt-4 max-w-3xl text-xs text-slate-500 print:hidden">
          Agreement text from{" "}
          <a className="underline" href="https://commonpaper.com/standards/mutual-nda/1.0/">Common Paper Mutual NDA v1.0</a>
          , licensed under{" "}
          <a className="underline" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Filled in with your details.
        </footer>
      </main>
    </div>
  );
}
