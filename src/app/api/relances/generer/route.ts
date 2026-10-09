import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/data/prospects";
import { FOLLOWUP_TONES, type FollowupTone } from "@/lib/prospects";
import {
  FOLLOWUP_HOURLY_LIMIT,
  FOLLOWUP_MODEL,
  FOLLOWUP_SYSTEM_PROMPT,
  buildFollowupUserPrompt,
} from "@/lib/ai/followup";
import { appendSignature, parseFollowupText, type FollowupStreamEvent } from "@/lib/ai/followup-format";

// Génère une relance pour un prospect et la diffuse en streaming (NDJSON, une ligne par événement) :
//   {"type":"delta","text":"…"}                          — texte au fil de l'eau
//   {"type":"done","relance":{id, objet, corps, ton}}    — relance enregistrée en base
//   {"type":"error","message":"…"}                       — échec (rien n'est enregistré)
// Les erreurs survenues avant le streaming renvoient un statut HTTP et {"message":"…"}.

export const maxDuration = 60;

function jsonError(status: number, message: string) {
  return Response.json({ message }, { status });
}

export async function POST(request: NextRequest) {
  let body: { prospectId?: unknown; ton?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Requête invalide.");
  }
  const prospectId = typeof body.prospectId === "string" ? body.prospectId : "";
  const tone = body.ton as FollowupTone;
  if (!isUuid(prospectId) || !(FOLLOWUP_TONES as readonly unknown[]).includes(tone)) {
    return jsonError(400, "Requête invalide.");
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return jsonError(401, "Session expirée : reconnectez-vous.");

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[relances] ANTHROPIC_API_KEY manquante");
    return jsonError(503, "La génération par l'IA n'est pas encore configurée.");
  }

  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const [prospectResult, profilResult, recentResult] = await Promise.all([
    supabase
      .from("prospects")
      .select("entreprise, contact_nom, etape, etape_brute, montant_eur, date_dernier_contact, notes")
      .eq("utilisateur_id", userId)
      .eq("id", prospectId)
      .maybeSingle(),
    supabase.from("utilisateurs").select("nom, entreprise, signature").eq("id", userId).maybeSingle(),
    supabase
      .from("relances")
      .select("id", { count: "exact", head: true })
      .eq("utilisateur_id", userId)
      .gte("cree_le", oneHourAgo),
  ]);

  if (prospectResult.error || profilResult.error || recentResult.error) {
    return jsonError(500, "Le prospect n'a pas pu être chargé. Réessayez.");
  }
  const prospect = prospectResult.data;
  if (!prospect) return jsonError(404, "Ce prospect n'existe plus.");
  if ((recentResult.count ?? 0) >= FOLLOWUP_HOURLY_LIMIT) {
    return jsonError(429, `Limite atteinte : ${FOLLOWUP_HOURLY_LIMIT} relances par heure. Réessayez un peu plus tard.`);
  }

  const profil = profilResult.data;
  const anthropic = new Anthropic();
  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: FollowupStreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        const stream = anthropic.beta.messages.stream(
          {
            model: FOLLOWUP_MODEL,
            max_tokens: 8000,
            // Email court : effort bas, réponse rapide. La réflexion adaptative reste active (Opus 5.5).
            output_config: { effort: "low" },
            // En cas de refus par les filtres de sécurité, l'API relance d'elle-même sur le modèle recommandé.
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            system: FOLLOWUP_SYSTEM_PROMPT,
            messages: [{ role: "user", content: buildFollowupUserPrompt(prospect, profil, tone) }],
          },
          { signal: request.signal }
        );

        stream.on("text", (text) => send({ type: "delta", text }));
        const message = await stream.finalMessage();

        if (message.stop_reason === "refusal") {
          send({ type: "error", message: "L'IA a refusé de rédiger cette relance. Modifiez les notes du prospect puis réessayez." });
          return;
        }
        const text = message.content
          .flatMap((block) => (block.type === "text" ? [block.text] : []))
          .join("")
          .trim();
        if (!text || message.stop_reason === "max_tokens") {
          send({ type: "error", message: "La rédaction a été interrompue. Réessayez." });
          return;
        }

        const parsed = parseFollowupText(text, `Suite à nos échanges · ${prospect.entreprise}`);
        const corps = appendSignature(parsed.corps, profil?.signature ?? null).slice(0, 10000);
        const objet = parsed.objet.slice(0, 300);

        const { data: saved, error } = await supabase
          .from("relances")
          .insert({ prospect_id: prospectId, utilisateur_id: userId, objet, corps, ton: tone, modele_ia: message.model })
          .select("id, objet, corps, ton")
          .single();
        if (error) {
          console.error("[relances] enregistrement impossible", { code: error.code });
          send({ type: "error", message: "La relance a été rédigée mais n'a pas pu être enregistrée. Réessayez." });
          return;
        }
        send({ type: "done", relance: saved });
      } catch (error) {
        if (request.signal.aborted || error instanceof Anthropic.APIUserAbortError) return;
        if (error instanceof Anthropic.RateLimitError) {
          send({ type: "error", message: "Le service d'IA est très sollicité. Réessayez dans une minute." });
        } else if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
          console.error("[relances] clé API Anthropic refusée");
          send({ type: "error", message: "La génération par l'IA est mal configurée. Contactez le support." });
        } else if (error instanceof Anthropic.APIError) {
          console.error("[relances] erreur API Anthropic", { status: error.status });
          send({ type: "error", message: "Le service d'IA est momentanément indisponible. Réessayez." });
        } else {
          console.error("[relances] erreur inattendue", error);
          send({ type: "error", message: "La rédaction a échoué. Réessayez." });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Flux déjà fermé (client parti).
        }
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
