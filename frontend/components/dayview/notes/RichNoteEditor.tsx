"use client";

import { useEffect, useRef, useState } from "react";

import { EditorToolbar } from "@/components/dayview/notes/EditorToolbar";

type SpeechRec = {
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
};

export function RichNoteEditor({
  html,
  revision,
  onChange,
  fullscreen,
  onToggleFullscreen,
}: {
  html: string;
  revision: number;
  onChange: (next: string) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [block, setBlock] = useState("H3");
  const [font, setFont] = useState("Arial");
  const [fontSize, setFontSize] = useState(16);
  const [micOn, setMicOn] = useState(false);
  const speechRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = html;
    // Only apply HTML when a note is loaded or a template is applied.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);

  function emit() {
    if (!ref.current) return;
    onChange(ref.current.innerHTML);
  }

  function run(command: string, value?: string) {
    ref.current?.focus();
    document.execCommand(command, false, value);
    emit();
  }

  function applyBlock(value: string) {
    setBlock(value);
    run("formatBlock", value === "P" ? "P" : value);
  }

  function applyFont(value: string) {
    setFont(value);
    run("fontName", value);
  }

  function applySize(px: number) {
    setFontSize(px);
    run("fontSize", "3");
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const node = sel.anchorNode?.parentElement;
    if (node) node.style.fontSize = `${px}px`;
    emit();
  }

  function applyLink() {
    const url = window.prompt("Link URL");
    if (!url) return;
    run("createLink", url);
  }

  function toggleMic() {
    const Ctor = (
      window as unknown as {
        SpeechRecognition?: new () => SpeechRec;
        webkitSpeechRecognition?: new () => SpeechRec;
      }
    ).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;

    if (!Ctor) {
      window.alert("Voice input is not supported in this browser.");
      return;
    }
    if (micOn) {
      speechRef.current?.stop();
      setMicOn(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const text = last?.[0]?.transcript;
      if (text) run("insertText", text + " ");
    };
    rec.onend = () => setMicOn(false);
    speechRef.current = rec;
    rec.start();
    setMicOn(true);
  }

  return (
    <div
      className={
        fullscreen
          ? "absolute inset-0 z-20 flex flex-col bg-[var(--color-surface)]"
          : "flex min-h-0 flex-1 flex-col"
      }
    >
      <EditorToolbar
        block={block}
        font={font}
        fontSize={fontSize}
        onBlock={applyBlock}
        onFont={applyFont}
        onFontSize={applySize}
        onCommand={run}
        onLink={applyLink}
        onColor={(c) => run("foreColor", c)}
        onHighlight={(c) => run("hiliteColor", c)}
        onMic={toggleMic}
        onFullscreen={onToggleFullscreen}
        micOn={micOn}
      />
      <div
        ref={ref}
        className="tf-note-editor min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4 outline-none"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Day note"
        onInput={emit}
        onBlur={emit}
      />
    </div>
  );
}
