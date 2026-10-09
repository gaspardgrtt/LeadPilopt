import { describe, expect, it } from "vitest";

import { LINK_ERRORS, linkErrorFromCode, linkErrorMessage } from "./link-errors";

describe("messages d'échec du lien", () => {
  it("affiche un message distinct par cause, rien pour une valeur inconnue", () => {
    const messages = new Set(LINK_ERRORS.map((reason) => linkErrorMessage(reason)));
    expect(messages.size).toBe(LINK_ERRORS.length);
    expect(linkErrorMessage("autre-navigateur")).toContain("navigateur où vous l'avez demandé");
    expect(linkErrorMessage("<script>")).toBeNull();
    expect(linkErrorMessage(undefined)).toBeNull();
    expect(linkErrorMessage("autre-navigateur", "en")).toContain("browser where you requested it");
  });

  it("traduit les codes Supabase", () => {
    expect(linkErrorFromCode("otp_expired")).toBe("lien-expire");
    expect(linkErrorFromCode("pkce_code_verifier_not_found")).toBe("autre-navigateur");
    expect(linkErrorFromCode("bad_code_verifier")).toBe("ancienne-demande");
    expect(linkErrorFromCode(null)).toBe("lien-invalide");
  });
});
