// Ajoute l'en-tête « fichier généré » aux types Supabase et remplace src/types/database.ts.
import { readFileSync, renameSync, writeFileSync } from "node:fs";

const generated = "src/types/database.gen.ts";
const target = "src/types/database.ts";
const header =
  "// Généré par `supabase gen types typescript` depuis le projet lié. Ne pas modifier à la main :\n" +
  "// régénérer après chaque migration avec `npm run db:types`.\n\n";

writeFileSync(generated, header + readFileSync(generated, "utf8"));
renameSync(generated, target);
