// Client minimal de l'API REST officielle Brevo (https://api.brevo.com/v3), sans dépendance :
// envoi d'un e-mail transactionnel (POST /smtp/email) et vérification de l'expéditeur
// (GET /senders). La clé n'est transmise que dans l'en-tête `api-key`, jamais journalisée ni
// renvoyée au navigateur. `fetchImpl` est injectable : les tests n'appellent jamais Brevo.

export const BREVO_API_URL = "https://api.brevo.com/v3";
const TIMEOUT_MS = 15_000;

export type BrevoConfig = { apiKey: string; senderEmail: string; senderName: string };

export type BrevoRecipient = { email: string; name?: string };

export type BrevoEmail = {
  to: BrevoRecipient;
  replyTo?: BrevoRecipient;
  subject: string;
  textContent: string;
  htmlContent: string;
  tags?: string[];
};

/**
 * Erreur Brevo présentable à l'utilisateur : `userMessage` ne contient jamais la clé ni la réponse
 * brute. `uncertain` : la requête a pu partir (délai dépassé, coupure) ; l'envoi a peut-être eu lieu.
 */
export class BrevoError extends Error {
  constructor(
    readonly userMessage: string,
    readonly status: number | null,
    readonly uncertain = false
  ) {
    super(`Brevo ${status ?? "réseau"} : ${userMessage}`);
    this.name = "BrevoError";
  }
}

function headers(apiKey: string): Record<string, string> {
  return { accept: "application/json", "content-type": "application/json", "api-key": apiKey };
}

/** Messages par statut HTTP, sans reprendre le texte renvoyé par Brevo. */
export function brevoErrorMessage(status: number): string {
  if (status === 400) return "Brevo a refusé le message : adresse ou contenu invalide.";
  if (status === 401) return "L'envoi par e-mail est mal configuré (clé Brevo refusée). Contactez l'administrateur.";
  if (status === 402) return "Le compte Brevo n'a plus de crédits d'envoi.";
  if (status === 403) return "Brevo refuse l'envoi depuis ce compte ou cet expéditeur. Vérifiez l'expéditeur dans Brevo.";
  if (status === 429) return "Trop d'envois en peu de temps. Réessayez dans une minute.";
  return "Brevo est momentanément indisponible. Réessayez dans quelques minutes.";
}

/** Envoie un e-mail transactionnel ; renvoie l'identifiant du message attribué par Brevo. */
export async function sendBrevoEmail(config: BrevoConfig, email: BrevoEmail, fetchImpl: typeof fetch = fetch): Promise<{ messageId: string }> {
  let response: Response;
  try {
    response = await fetchImpl(`${BREVO_API_URL}/smtp/email`, {
      method: "POST",
      headers: headers(config.apiKey),
      body: JSON.stringify({
        sender: { email: config.senderEmail, name: config.senderName },
        to: [email.to.name ? email.to : { email: email.to.email }],
        ...(email.replyTo ? { replyTo: email.replyTo } : {}),
        subject: email.subject,
        textContent: email.textContent,
        htmlContent: email.htmlContent,
        ...(email.tags?.length ? { tags: email.tags } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    // Délai dépassé ou coupure réseau : la requête a pu atteindre Brevo.
    throw new BrevoError("La connexion à Brevo a été interrompue : l'e-mail a peut-être été envoyé. Vérifiez dans Brevo avant de renvoyer.", null, true);
  }

  if (!response.ok) throw new BrevoError(brevoErrorMessage(response.status), response.status);

  const payload = (await response.json().catch(() => null)) as { messageId?: unknown } | null;
  if (typeof payload?.messageId !== "string" || !payload.messageId) {
    throw new BrevoError("Brevo a accepté la requête sans renvoyer d'identifiant de message. Vérifiez dans Brevo avant de renvoyer.", response.status, true);
  }
  return { messageId: payload.messageId.slice(0, 300) };
}

export type SenderStatus = { ok: true } | { ok: false; message: string };

/**
 * Vérifie que l'adresse d'expédition est un expéditeur Brevo existant et actif (validé). On ne
 * suppose jamais qu'il l'est : sans confirmation de Brevo, l'envoi est refusé.
 */
export async function checkBrevoSender(config: BrevoConfig, fetchImpl: typeof fetch = fetch): Promise<SenderStatus> {
  let response: Response;
  try {
    response = await fetchImpl(`${BREVO_API_URL}/senders`, {
      method: "GET",
      headers: headers(config.apiKey),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return { ok: false, message: "Impossible de vérifier l'expéditeur auprès de Brevo pour le moment. Réessayez." };
  }
  if (!response.ok) return { ok: false, message: brevoErrorMessage(response.status) };

  const payload = (await response.json().catch(() => null)) as { senders?: { email?: unknown; active?: unknown }[] } | null;
  const sender = payload?.senders?.find(
    (candidate) => typeof candidate.email === "string" && candidate.email.toLowerCase() === config.senderEmail.toLowerCase()
  );
  if (!sender) {
    return { ok: false, message: "L'adresse d'expédition n'est pas déclarée comme expéditeur dans Brevo. Ajoutez-la et validez-la dans Brevo." };
  }
  if (sender.active !== true) {
    return { ok: false, message: "L'expéditeur n'est pas encore validé dans Brevo. Validez-le (lien reçu par e-mail ou domaine authentifié)." };
  }
  return { ok: true };
}
