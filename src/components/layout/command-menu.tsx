"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { NAV_ITEMS } from "@/components/layout/navigation";

// Spéc. UX/UI §10 — ⌘K ouvre la palette ; « G puis D / R / K / A / P / I » navigue entre les écrans.
// La recherche de prospects s'ajoutera ici avec la liste (E4).

type CommandMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const CommandMenuContext = React.createContext<CommandMenuContextValue | null>(null);

export function useCommandMenu() {
  const context = React.useContext(CommandMenuContext);
  if (!context) throw new Error("useCommandMenu doit être utilisé dans <CommandMenuProvider>.");
  return context;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function CommandMenuProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const goPending = React.useRef<number | null>(null);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toUpperCase();
      if (goPending.current !== null) {
        window.clearTimeout(goPending.current);
        goPending.current = null;
        const item = NAV_ITEMS.find((nav) => nav.goKey === key);
        if (item) {
          event.preventDefault();
          router.push(item.href);
        }
        return;
      }
      if (key === "G") {
        goPending.current = window.setTimeout(() => {
          goPending.current = null;
        }, 1000);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  const value = React.useMemo(() => ({ open, setOpen }), [open]);

  return (
    <CommandMenuContext.Provider value={value}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen} title="Palette de commandes" description="Aller à un écran">
        <CommandInput placeholder="Aller à…" />
        <CommandList>
          <CommandEmpty>Aucun résultat.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {NAV_ITEMS.map((item) => (
              <CommandItem
                key={item.href}
                onSelect={() => {
                  setOpen(false);
                  router.push(item.href);
                }}
              >
                <item.icon strokeWidth={1.75} />
                {item.label}
                <CommandShortcut>G {item.goKey}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </CommandMenuContext.Provider>
  );
}
