-- Prospects particuliers (acheteurs, vendeurs, propriétaires, investisseurs) : l'entreprise devient
-- facultative. Migration additive : aucune ligne n'est supprimée ni modifiée.
--
-- Un prospect doit rester identifiable : entreprise OU nom du contact. Aucune entreprise n'est
-- inventée pour remplir le champ.
--
-- Clé de dédoublonnage à l'import (`cle_import`, colonne générée) :
--   - avec une entreprise : e-mail + entreprise, exactement la règle actuelle
--     (unique nulls not distinct (utilisateur_id, contact_email, entreprise)) ;
--   - particulier : le nom du contact (sans casse) et son e-mail, ou son téléphone sans e-mail.
--     Le nom fait partie de la clé : deux personnes partageant une adresse (un couple, par
--     exemple) restent deux prospects.
-- Avec l'ancienne règle, tous les particuliers sans e-mail auraient la même clé (null, null) et un
-- ré-import les fusionnerait en une seule fiche.
-- Les prospects existants ont tous une entreprise : leur clé reprend la règle actuelle, déjà
-- unique, donc la nouvelle contrainte ne peut pas échouer sur les données existantes.

alter table public.prospects
  alter column entreprise drop not null;

alter table public.prospects
  add constraint prospects_identifiable
    check (entreprise is not null or (contact_nom is not null and char_length(btrim(contact_nom)) > 0));

-- Le retour à la ligne sépare les parties sans ambiguïté : il est absent des e-mails validés et
-- des noms nettoyés à l'import.
alter table public.prospects
  add column cle_import text generated always as (
    case
      when entreprise is not null then 'e:' || coalesce(contact_email, '') || E'\n' || entreprise
      else 'p:' || lower(btrim(contact_nom)) || E'\n'
        || coalesce('m:' || contact_email, 't:' || coalesce(contact_telephone, ''))
    end
  ) stored;

comment on column public.prospects.cle_import is
  'Clé de dédoublonnage des imports : e-mail + entreprise, sinon nom + e-mail (ou téléphone).';

alter table public.prospects
  add constraint prospects_unicite_cle_import unique (utilisateur_id, cle_import);

-- L'ancienne contrainte est remplacée par la nouvelle clé, qui reprend la même règle pour les
-- prospects avec entreprise. Supprimer une contrainte ne supprime aucune donnée.
alter table public.prospects
  drop constraint prospects_unicite_import;
