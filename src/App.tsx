import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  CircleStop,
  Gauge,
  Keyboard,
  Minus,
  Pin,
  Play,
  Timer,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import appIcon from "@/assets/app-icon.png";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type TypingPayload = {
  current: number;
  total: number;
  status: "countdown" | "typing" | "done" | "stopped" | "error";
  message: string;
};

type WindowState = {
  alwaysOnTop: boolean;
  opacity: number;
};

const DEFAULT_PROGRESS: TypingPayload = {
  current: 0,
  total: 0,
  status: "stopped",
  message: "Ready"
};

const appWindow = getCurrentWindow();

export default function App() {
  const [text, setText] = useState("");
  const [delayMs, setDelayMs] = useState(35);
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [typing, setTyping] = useState(false);
  const [progress, setProgress] = useState<TypingPayload>(DEFAULT_PROGRESS);

  const charCount = useMemo(() => Array.from(text).length, [text]);
  const progressValue =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listen<TypingPayload>("typing-progress", (event) => {
      setProgress(event.payload);

      if (
        event.payload.status === "done" ||
        event.payload.status === "stopped" ||
        event.payload.status === "error"
      ) {
        setTyping(false);
      }
    }).then((cleanup) => {
      unlisten = cleanup;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  async function startTyping() {
    if (!text.trim() || typing) {
      return;
    }

    setTyping(true);
    setProgress({
      current: 0,
      total: charCount,
      status: "countdown",
      message: "Counting down"
    });

    try {
      await invoke("start_typing", {
        request: {
          text,
          delayMs,
          countdownSeconds
        }
      });
    } catch (error) {
      setTyping(false);
      setProgress({
        current: 0,
        total: charCount,
        status: "error",
        message: String(error)
      });
    }
  }

  async function stopTyping() {
    await invoke("stop_typing");
  }

  async function toggleAlwaysOnTop(checked: boolean) {
    const nextState = await invoke<WindowState>("set_window_state", {
      state: { alwaysOnTop: checked }
    });
    setAlwaysOnTop(nextState.alwaysOnTop);
  }

  function startWindowDrag(event: React.MouseEvent<HTMLElement>) {
    if (event.button !== 0) {
      return;
    }

    void appWindow.startDragging();
  }

  return (
    <div className="flex h-screen w-screen min-w-0 flex-col overflow-hidden bg-background text-foreground">
      <header
        className="flex h-11 shrink-0 select-none items-stretch border-b bg-card"
        data-tauri-drag-region
      >
        <div
          className="flex min-w-0 flex-1 cursor-move items-center gap-2 px-3"
          data-tauri-drag-region
          onMouseDown={startWindowDrag}
        >
          <img
            src={appIcon}
            alt=""
            draggable={false}
            className="h-7 w-7 shrink-0 rounded-sm object-cover"
            data-tauri-drag-region
          />
          <div className="min-w-0" data-tauri-drag-region>
            <div
              className="truncate text-sm font-semibold leading-4"
              data-tauri-drag-region
            >
              Text Typer
            </div>
            <div
              className="truncate text-[11px] leading-3 text-muted-foreground"
              data-tauri-drag-region
            >
              {progress.message}
            </div>
          </div>
        </div>

        <div className="flex h-full shrink-0">
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-12 rounded-none"
            aria-label="Minimize window"
            onClick={() => void invoke("minimize_window")}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-12 rounded-none hover:bg-destructive hover:text-destructive-foreground"
            aria-label="Close window"
            onClick={() => void invoke("close_window")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto_auto_auto] gap-3 p-3">
        <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="text-input" className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-primary" />
              Text
            </Label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {charCount} {charCount === 1 ? "char" : "chars"}
            </span>
          </div>

          <Textarea
            id="text-input"
            value={text}
            disabled={typing}
            spellCheck={false}
            placeholder="Paste text here"
            className="min-h-0 resize-none font-mono text-[13px]"
            onChange={(event) => setText(event.target.value)}
          />

          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-2 text-muted-foreground"
              disabled={typing || charCount === 0}
              onClick={() => {
                setText("");
                setProgress(DEFAULT_PROGRESS);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
            <div
              className={cn(
                "rounded-sm px-2 py-1 text-xs font-medium",
                progress.status === "error"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-secondary text-secondary-foreground"
              )}
            >
              {typing ? "Active" : "Idle"}
            </div>
          </div>
        </section>

        <section className="grid gap-3 rounded-md border bg-card p-3 shadow-sm">
          <div className="grid grid-cols-[92px_minmax(0,1fr)_48px] items-center gap-3">
            <Label className="flex items-center gap-2 text-muted-foreground">
              <Gauge className="h-4 w-4 text-primary" />
              Delay
            </Label>
            <Slider
              min={5}
              max={250}
              step={5}
              value={[delayMs]}
              disabled={typing}
              onValueChange={([value]) => setDelayMs(value)}
            />
            <output className="text-right text-xs font-semibold tabular-nums">
              {delayMs} ms
            </output>
          </div>

          <Separator />

          <div className="grid grid-cols-[92px_minmax(0,1fr)_48px] items-center gap-3">
            <Label className="flex items-center gap-2 text-muted-foreground">
              <Timer className="h-4 w-4 text-primary" />
              Wait
            </Label>
            <Slider
              min={0}
              max={10}
              step={1}
              value={[countdownSeconds]}
              disabled={typing}
              onValueChange={([value]) => setCountdownSeconds(value)}
            />
            <output className="text-right text-xs font-semibold tabular-nums">
              {countdownSeconds} s
            </output>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <Label
              htmlFor="pin-window"
              className="flex items-center gap-2 text-muted-foreground"
            >
              <Pin className="h-4 w-4 text-primary" />
              Keep on top
            </Label>
            <Switch
              id="pin-window"
              checked={alwaysOnTop}
              onCheckedChange={(checked) => void toggleAlwaysOnTop(checked)}
            />
          </div>
        </section>

        <section className="rounded-md border bg-card p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs font-medium">
            <span className="truncate">{progress.message}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {progress.current} / {progress.total}
            </span>
          </div>
          <Progress value={progressValue} />
        </section>

        <footer className="grid grid-cols-[104px_minmax(0,1fr)] gap-2">
          <Button
            type="button"
            variant="secondary"
            className="h-11"
            disabled={!typing}
            onClick={() => void stopTyping()}
          >
            <CircleStop className="h-4 w-4" />
            Stop
          </Button>
          <Button
            type="button"
            className="h-11"
            disabled={typing || charCount === 0}
            onClick={() => void startTyping()}
          >
            <Play className="h-4 w-4 fill-current" />
            Type
          </Button>
        </footer>
      </main>
    </div>
  );
}
