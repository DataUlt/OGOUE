-- ============================================================
-- Reparation des cles etrangeres pointant vers organizations
-- ------------------------------------------------------------
-- PROBLEME
-- Les tables filles d'organizations (sales, users, expenses, agents,
-- articles, deletion_audit, receipt_counters...) declarent leur colonne
-- organization_id en NOT NULL, mais leur cle etrangere est en
-- ON DELETE SET NULL. Les deux regles se contredisent : supprimer une
-- organisation demande d'ecrire NULL dans une colonne qui l'interdit.
--
--   ERROR: 23502: null value in column "organization_id" of relation
--   "sales" violates not-null constraint
--
-- Consequence : AUCUNE organisation referencee ne peut etre supprimee,
-- et l'erreur se deplace de table en table a chaque tentative.
--
-- La migration d'origine (_archives/SUPABASE_MIGRATION_PUBLIC.sql)
-- declarait pourtant ON DELETE CASCADE. La base reelle a derive.
--
-- ------------------------------------------------------------
-- CE QUE FAIT CE FICHIER
-- Il remet en CASCADE toutes les cles etrangeres vers organizations
-- qui ne le sont pas deja. Il se decouvre lui-meme : pas besoin de
-- connaitre a l'avance les noms des contraintes ni la liste des tables.
--
-- ------------------------------------------------------------
-- /!\ AVERTISSEMENT
-- Apres cette migration, supprimer une ligne d'organizations supprimera
-- AUSSI, sans confirmation et sans retour possible, toutes ses ventes,
-- depenses, articles, agents, utilisateurs et son historique.
-- C'est le comportement voulu pour faire le menage, et une catastrophe
-- sur un vrai client. TOUJOURS compter avant de supprimer (voir
-- l'etape 1 ci-dessous).
--
-- A executer dans Supabase : Dashboard > SQL Editor > New query
-- ============================================================


-- ------------------------------------------------------------
-- ETAPE 1 : etat des lieux (a lancer seul, avant toute chose)
-- ------------------------------------------------------------
-- SELECT
--   con.conrelid::regclass AS table_enfant,
--   att.attname            AS colonne,
--   CASE con.confdeltype
--     WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
--     WHEN 'c' THEN 'CASCADE'   WHEN 'n' THEN 'SET NULL'
--     WHEN 'd' THEN 'SET DEFAULT'
--   END                    AS a_la_suppression,
--   con.conname            AS nom_contrainte
-- FROM pg_constraint con
-- JOIN pg_attribute att
--   ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
-- WHERE con.contype = 'f'
--   AND con.confrelid = 'public.organizations'::regclass
-- ORDER BY 1;


-- ------------------------------------------------------------
-- ETAPE 2 : la correction
-- ------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  n INTEGER := 0;
BEGIN
  FOR r IN
    SELECT
      con.conname                  AS nom,
      con.conrelid::regclass::text AS table_enfant,
      att.attname                  AS colonne
    FROM pg_constraint con
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.organizations'::regclass
      -- on ne touche pas a ce qui est deja correct
      AND con.confdeltype <> 'c'
      -- cles simples uniquement : une cle composite demanderait une
      -- reecriture manuelle, autant la signaler que la casser
      AND array_length(con.conkey, 1) = 1
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.table_enfant, r.nom);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) '
      || 'REFERENCES organizations(id) ON DELETE CASCADE',
      r.table_enfant, r.nom, r.colonne
    );
    n := n + 1;
    RAISE NOTICE 'Corrigee : %.% (contrainte %)', r.table_enfant, r.colonne, r.nom;
  END LOOP;

  RAISE NOTICE '% cle(s) etrangere(s) repassee(s) en CASCADE.', n;
END $$;


-- ------------------------------------------------------------
-- ETAPE 3 : verification (relancer la requete de l'etape 1)
-- ------------------------------------------------------------
-- Toutes les lignes doivent afficher CASCADE.


-- ------------------------------------------------------------
-- RETOUR ARRIERE
-- ------------------------------------------------------------
-- Il n'y a pas lieu de restaurer SET NULL : c'etait precisement l'etat
-- casse. Pour revenir a un comportement prudent, passer les cles en
-- NO ACTION : la suppression d'une organisation sera alors refusee
-- proprement tant qu'il reste des lignes filles, au lieu d'echouer sur
-- une violation de contrainte NOT NULL.
--
--   ALTER TABLE sales DROP CONSTRAINT sales_organization_id_fkey;
--   ALTER TABLE sales ADD CONSTRAINT sales_organization_id_fkey
--     FOREIGN KEY (organization_id) REFERENCES organizations(id);
