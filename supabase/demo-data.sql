-- Données de démonstration pour tester LeadPilot avant la fonctionnalité d'import.
-- Usage : se connecter une première fois à l'application (le compte est créé au premier lien),
-- remplacer l'adresse ci-dessous, puis exécuter ce script dans Supabase > SQL Editor.
-- Le script est rejouable : il remplace les prospects de démonstration du compte.
-- Les scores et CA récupérables sont des valeurs d'exemple, pas des calculs.

do $$
declare
  compte uuid;
  demo uuid := '00000000-0000-0000-0000-00000000d3e0';
  acme uuid;
begin
  select id into compte from public.utilisateurs where email = lower('vous@entreprise.fr');
  if compte is null then
    raise exception 'Aucun compte LeadPilot pour cette adresse : connectez-vous une première fois à l''application.';
  end if;

  delete from public.prospects where utilisateur_id = compte and import_id = demo;

  insert into public.prospects
    (utilisateur_id, import_id, entreprise, contact_nom, contact_email, montant_eur, etape, date_dernier_contact,
     notes, est_oublie, proba_recuperation, ca_recuperable_eur, score, statut)
  values
    (compte, demo, 'Nordwind GmbH', 'Jonas Weber', 'j.weber@nordwind.de', 41700, 'negociation', current_date - 26,
     'Comité d''achat reporté à la rentrée.', true, 0.5133, 21400, 91, 'a_traiter'),
    (compte, demo, 'Atelier Lumen', 'Inès Morel', 'ines@atelier-lumen.fr', 31900, 'proposition', current_date - 41,
     null, true, 0.3089, 9850, 78, 'relance'),
    (compte, demo, 'Kairos Conseil', 'Hugo Lefèvre', 'hugo@kairos-conseil.fr', 20800, 'negociation', current_date - 63,
     null, true, 0.3900, 8100, 70, 'a_traiter'),
    (compte, demo, 'Acme SAS', 'Claire Martin', 'claire@acme.fr', 15000, 'proposition', current_date - 34,
     'Intéressée, attend la validation du budget Q4 avant de signer.', true, 0.3244, 4870, 64, 'a_traiter'),
    (compte, demo, 'Brio Logistique', 'Sarah Benali', 's.benali@brio.fr', 20500, 'qualification', current_date - 22,
     null, true, 0.1756, 3600, 52, 'a_traiter'),
    (compte, demo, 'Opaline Studio', 'Léa Garnier', 'lea@opaline.studio', 6000, 'qualification', current_date - 75,
     null, true, 0.1167, 700, 25, 'ignore'),
    (compte, demo, 'Vertex Industries', 'Marc Dubois', 'm.dubois@vertex.fr', 12000, 'negociation', current_date - 8,
     null, false, null, null, null, 'a_traiter'),
    (compte, demo, 'Solenne Bio', 'Anaïs Roux', 'anais@solenne-bio.fr', 12000, 'negociation', current_date - 90,
     null, false, null, null, null, 'gagne');

  select id into acme from public.prospects where utilisateur_id = compte and import_id = demo and entreprise = 'Acme SAS';
  insert into public.relances (prospect_id, utilisateur_id, objet, corps, ton, modele_ia)
  values (acme, compte, 'Notre proposition et votre budget Q4',
    E'Bonjour Claire,\n\nDébut septembre, vous attendiez la validation du budget Q4 pour avancer sur notre proposition.\n\nEst-ce toujours d''actualité ? Je peux vous appeler jeudi à 10 h pour faire le point.\n\nBien cordialement,',
    'direct', 'demo');

  insert into public.relances (prospect_id, utilisateur_id, objet, corps, ton, modele_ia, copiee_le)
  select id, compte, 'Point sur votre projet', E'Bonjour Anaïs,\n\nOù en est votre projet ?', 'direct', 'demo', now() - interval '20 days'
  from public.prospects where utilisateur_id = compte and import_id = demo and entreprise = 'Solenne Bio';
end $$;
