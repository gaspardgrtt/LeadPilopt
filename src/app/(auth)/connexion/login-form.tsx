"use client";

import * as React from "react";
import { ArrowRightIcon, CircleAlertIcon, MailCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field } from "@/components/shared/field";

import { requestMagicLink, type MagicLinkState } from "./actions";

const RESEND_DELAY_SECONDS = 30;

type LoginFormProps = {
  /** Destination après connexion, transmise par le middleware. */
  next?: string;
  /** Erreur renvoyée par /auth/confirm (lien expiré ou déjà utilisé). */
  linkError?: boolean;
};

export function LoginForm({ next, linkError = false }: LoginFormProps) {
  const [state, formAction, pending] = React.useActionState<MagicLinkState, FormData>(requestMagicLink, {
    status: "idle",
  });
  const [editing, setEditing] = React.useState(false);
  const [mode, setMode] = React.useState("connexion");

  if (state.status === "sent" && !editing) {
    return <SentState email={state.email} next={next} formAction={formAction} pending={pending} onChangeEmail={() => setEditing(true)} />;
  }

  const fieldError = state.status === "error" && state.field === "email" ? state.message : undefined;
  const formError = state.status === "error" && !state.field ? state.message : undefined;
  const defaultEmail = state.status === "idle" ? "" : state.email;

  const form = (submitLabel: string, label: string, placeholder: string, hint: string) => (
    <form
      action={(formData) => {
        setEditing(false);
        formAction(formData);
      }}
      className="flex flex-col gap-5 p-6"
      noValidate
    >
      {next && <input type="hidden" name="suivant" value={next} />}
      {(linkError || formError) && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3.5 py-2.5 text-dense text-danger">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {formError ?? "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau ci-dessous."}
        </p>
      )}
      <Field label={label} htmlFor={`email-${mode}`} hint={hint} error={fieldError}>
        <Input
          id={`email-${mode}`}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder={placeholder}
          defaultValue={defaultEmail}
          required
          autoFocus
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {submitLabel}
        {!pending && <ArrowRightIcon />}
      </Button>
    </form>
  );

  return (
    <div className="rounded-lg border bg-surface shadow-card">
      <Tabs value={mode} onValueChange={setMode}>
        <TabsList>
          <TabsTrigger value="connexion">Connexion</TabsTrigger>
          <TabsTrigger value="inscription">Inscription</TabsTrigger>
        </TabsList>
        <TabsContent value="connexion">
          {form(
            "Recevoir le lien de connexion",
            "Email",
            "votre@email.com",
            "Nous vous envoyons un lien de connexion, sans mot de passe."
          )}
        </TabsContent>
        <TabsContent value="inscription">
          {form(
            "Créer mon compte",
            "Email professionnel",
            "votre@entreprise.com",
            "Pas de carte bancaire. Vous recevez un lien pour activer votre compte."
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

type SentStateProps = {
  email: string;
  next?: string;
  formAction: (formData: FormData) => void;
  pending: boolean;
  onChangeEmail: () => void;
};

/** E1, état 2 : confirmation d'envoi, renvoi possible après 30 s. */
function SentState({ email, next, formAction, pending, onChangeEmail }: SentStateProps) {
  const [secondsLeft, setSecondsLeft] = React.useState(RESEND_DELAY_SECONDS);

  React.useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  return (
    <div className="rounded-lg border bg-surface p-6 text-center shadow-card" role="status">
      <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-primary-soft">
        <MailCheckIcon className="size-6 text-primary" strokeWidth={2} aria-hidden />
      </div>
      <h2 className="text-[16px] leading-6 font-semibold text-foreground">Vérifiez votre boîte mail</h2>
      <p className="mt-1.5 text-body text-foreground-secondary">
        Lien envoyé à <span className="font-medium text-foreground">{email}</span>
      </p>
      <p className="mt-0.5 text-dense text-foreground-tertiary">Valable 15 minutes</p>
      <form
        action={(formData) => {
          setSecondsLeft(RESEND_DELAY_SECONDS);
          formAction(formData);
        }}
        className="mt-6"
      >
        <input type="hidden" name="email" value={email} />
        {next && <input type="hidden" name="suivant" value={next} />}
        <Button type="submit" variant="secondary" size="lg" className="w-full" disabled={secondsLeft > 0} loading={pending}>
          {secondsLeft > 0 ? `Renvoyer le lien (${secondsLeft} s)` : "Renvoyer le lien"}
        </Button>
      </form>
      <button
        type="button"
        onClick={onChangeEmail}
        className="mt-4 rounded-sm text-dense text-foreground-secondary underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-primary/25"
      >
        Changer d&apos;adresse
      </button>
    </div>
  );
}
