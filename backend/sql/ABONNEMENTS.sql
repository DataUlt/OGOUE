-- ============================================================
-- Formule souscrite par une organisation
-- ------------------------------------------------------------
-- Jusqu'ici la page tarifs annoncait des limites que le code
-- n'appliquait pas : n'importe quel compte avait acces aux recus, aux
-- justificatifs, aux agents et aux etats financiers. Ces colonnes
-- portent la formule reellement souscrite, et le backend s'y refere.
--
-- L'encaissement est manuel : le client verse par Airtel Money puis
-- envoie sa capture. C'est vous qui passez ensuite l'organisation de
-- 'essentiel' a 'pro' ou 'equipe', d'ou plan_note, qui garde
-- la trace de ce qui a justifie l'activation.
--
-- A executer dans Supabase : Dashboard > SQL Editor > New query
-- ============================================================

ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS plan           TEXT NOT NULL DEFAULT 'essentiel',
    ADD COLUMN IF NOT EXISTS plan_periode   TEXT,
    ADD COLUMN IF NOT EXISTS plan_debut     DATE,
    ADD COLUMN IF NOT EXISTS plan_expire_le DATE,
    ADD COLUMN IF NOT EXISTS plan_note      TEXT;

-- ------------------------------------------------------------
-- Renommage : boutique -> pro, entreprise -> equipe
-- ------------------------------------------------------------
-- Les formules s'appellent desormais Essentiel, Pro et Equipe. Les cles
-- stockees suivent, et ne se contentent pas des noms affiches : c'est
-- cette valeur-la qui se tape a la main dans le Table Editor, et un
-- decalage entre ce qu'on lit a l'ecran et ce qu'on doit ecrire est une
-- faute de frappe qui attend son jour.
--
-- La contrainte est levee le temps de la bascule, sinon elle refuserait
-- les nouvelles valeurs avant d'avoir ete remplacee. Relancer ce fichier
-- est sans effet : plus aucune ligne ne porte les anciennes cles.
ALTER TABLE public.organizations
    DROP CONSTRAINT IF EXISTS organizations_plan_valide;

UPDATE public.organizations SET plan = 'pro'    WHERE plan = 'boutique';
UPDATE public.organizations SET plan = 'equipe' WHERE plan = 'entreprise';

-- Une faute de frappe dans un UPDATE manuel donnerait acces a tout, ou a
-- rien, sans que rien ne le signale. La contrainte ferme cette porte.
ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_plan_valide
    CHECK (plan IN ('essentiel', 'pro', 'equipe'));

ALTER TABLE public.organizations
    DROP CONSTRAINT IF EXISTS organizations_plan_periode_valide;
ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_plan_periode_valide
    CHECK (plan_periode IS NULL OR plan_periode IN ('mensuel', 'annuel'));

-- ------------------------------------------------------------
-- Une formule payante doit porter une date de fin
-- ------------------------------------------------------------
-- Sans plan_expire_le, formuleActive() considere l'abonnement comme
-- valable indefiniment. Or l'encaissement est manuel : chaque activation
-- est un UPDATE tape a la main. Oublier la date une seule fois offre la
-- formule a vie, sans que rien ne le signale — ni facture impayee, ni
-- alerte, ni jauge, puisqu'il n'y a justement rien a decompter.
--
-- On repare d'abord les lignes deja dans ce cas, sinon la contrainte
-- serait refusee. La duree retenue est celle de la periode enregistree,
-- comptee depuis le debut connu, a defaut depuis aujourd'hui : c'est
-- l'hypothese la plus proche de ce qui a ete vendu.
UPDATE public.organizations
SET plan_expire_le = (COALESCE(plan_debut, CURRENT_DATE)
                   + CASE WHEN plan_periode = 'annuel'
                          THEN INTERVAL '1 year'
                          ELSE INTERVAL '1 month' END)::date
WHERE plan <> 'essentiel'
  AND plan_expire_le IS NULL;

-- ------------------------------------------------------------
-- Les dates se remplissent toutes seules
-- ------------------------------------------------------------
-- L'activation se fait en changeant la seule colonne `plan` dans le
-- Table Editor, une fois le versement verifie. C'est le geste le plus
-- simple et le moins faillible : exiger quatre colonnes coherentes a la
-- main a chaque vente, c'est se tromper un jour.
--
-- Le trigger calcule donc plan_debut et plan_expire_le a partir de la
-- periode. La contrainte plus bas ne sert plus qu'a prouver qu'il a bien
-- fait son travail : c'est lui qui rend l'activation possible, elle qui
-- garantit qu'aucun chemin detourne ne la contredit.
--
-- La periode par defaut est 'mensuel'. C'est le cas courant, et se
-- tromper dans ce sens coute un mois offert, jamais onze.
--   -> Pour un abonnement ANNUEL, mettre plan_periode a 'annuel' dans la
--      meme edition ; le trigger la respecte et compte un an.
--   -> Pour une date choisie a la main, renseigner plan_expire_le : le
--      trigger n'y touche pas.
CREATE OR REPLACE FUNCTION public.completer_dates_abonnement()
RETURNS TRIGGER AS $$
DECLARE
    -- OLD n'existe pas sur un INSERT : y toucher leve « record old is
    -- not assigned yet », y compris derriere un OR, PL/pgSQL evaluant
    -- l'expression entiere. Les anciennes valeurs sont donc recopiees
    -- une fois, sous garde, et c'est elles qu'on compare ensuite.
    est_update       BOOLEAN := (TG_OP = 'UPDATE');
    ancien_plan      TEXT := NULL;
    ancienne_periode TEXT := NULL;
    ancienne_fin     DATE := NULL;
    ancienne_note    TEXT := NULL;
    plan_change      BOOLEAN;
    date_fournie     BOOLEAN;
BEGIN
    IF est_update THEN
        ancien_plan      := OLD.plan;
        ancienne_periode := OLD.plan_periode;
        ancienne_fin     := OLD.plan_expire_le;
        ancienne_note    := OLD.plan_note;
    END IF;

    -- Retour a la gratuite : plus rien a decompter. plan_note n'est pas
    -- touchee, c'est la memoire de ce qui s'est passe.
    IF NEW.plan = 'essentiel' THEN
        NEW.plan_periode   := NULL;
        NEW.plan_debut     := NULL;
        NEW.plan_expire_le := NULL;
        RETURN NEW;
    END IF;

    plan_change := (NOT est_update) OR (NEW.plan IS DISTINCT FROM ancien_plan);

    -- Une date posee dans la meme instruction est un choix explicite :
    -- on ne la recalcule pas. C'est par la que passe un renouvellement.
    date_fournie := est_update
                    AND (NEW.plan_expire_le IS DISTINCT FROM ancienne_fin)
                    AND (NEW.plan_expire_le IS NOT NULL);

    IF date_fournie THEN
        RETURN NEW;
    END IF;

    -- On (re)calcule dans deux cas : la formule vient de changer, ou la
    -- ligne trainait sans date de fin.
    IF plan_change OR NEW.plan_expire_le IS NULL THEN
        -- Periode : forcee a 'mensuel' quand la formule vient de changer
        -- sans que l'instruction en designe une, pour ne pas heriter du
        -- 'annuel' d'un abonnement precedent — onze mois offerts sans que
        -- personne le voie. Sur une simple reparation de ligne, au
        -- contraire, la periode enregistree est la seule trace de ce qui
        -- a ete vendu : on la respecte.
        IF plan_change
           AND ((NOT est_update) OR (NEW.plan_periode IS NOT DISTINCT FROM ancienne_periode)) THEN
            NEW.plan_periode := 'mensuel';
        END IF;
        NEW.plan_periode := COALESCE(NEW.plan_periode, 'mensuel');

        -- Une activation part d'aujourd'hui. Une reparation, elle, garde
        -- le debut deja inscrit : c'est de la que court ce qui a ete paye,
        -- meme si l'echeance calculee tombe alors dans le passe.
        IF plan_change THEN
            NEW.plan_debut := CURRENT_DATE;
        ELSE
            NEW.plan_debut := COALESCE(NEW.plan_debut, CURRENT_DATE);
        END IF;

        NEW.plan_expire_le := (NEW.plan_debut + CASE WHEN NEW.plan_periode = 'annuel'
                                                     THEN INTERVAL '1 year'
                                                     ELSE INTERVAL '1 month' END)::date;

        -- Trace, seulement si l'instruction n'en portait pas : une note
        -- ecrite a la main ne doit jamais etre ecrasee.
        IF (NOT est_update) OR (NEW.plan_note IS NOT DISTINCT FROM ancienne_note) THEN
            NEW.plan_note := 'Activation ' || NEW.plan || ' (' || NEW.plan_periode
                          || ') le ' || to_char(CURRENT_DATE, 'DD/MM/YYYY')
                          || ', echeance ' || to_char(NEW.plan_expire_le, 'DD/MM/YYYY');
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_completer_dates_abonnement ON public.organizations;
CREATE TRIGGER trg_completer_dates_abonnement
    BEFORE INSERT OR UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.completer_dates_abonnement();

ALTER TABLE public.organizations
    DROP CONSTRAINT IF EXISTS organizations_plan_payant_date_fin;
ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_plan_payant_date_fin
    CHECK (plan = 'essentiel' OR plan_expire_le IS NOT NULL);

COMMENT ON COLUMN public.organizations.plan IS
    'Formule souscrite : essentiel (gratuit), pro ou equipe.';
COMMENT ON COLUMN public.organizations.plan_expire_le IS
    'Fin de validite. NULL = pas d''echeance (formule gratuite). Une date passee fait retomber l''organisation sur essentiel.';
COMMENT ON COLUMN public.organizations.plan_note IS
    'Trace de l''activation manuelle : date du versement, reference Airtel Money, qui a valide.';

-- Retrouver les abonnements qui arrivent a echeance.
CREATE INDEX IF NOT EXISTS idx_organizations_plan_expire
    ON public.organizations (plan_expire_le)
    WHERE plan_expire_le IS NOT NULL;

NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------
-- ACTIVER UNE FORMULE APRES RECEPTION DU VERSEMENT
-- ------------------------------------------------------------
-- MENSUEL — Table Editor : remplacer la valeur de la colonne `plan` par
-- 'pro' ou 'equipe', et rien d'autre. Le trigger pose la date
-- de debut, l'echeance a un mois et la note.
--
-- L'equivalent en SQL :
-- UPDATE public.organizations SET plan = 'pro'
-- WHERE name = 'NOM DE L ENTREPRISE';
--
-- ANNUEL — changer `plan` ET `plan_periode` ('annuel') dans la meme
-- edition. Dans le Table Editor, les deux cellules se modifient dans la
-- meme fenetre avant d'enregistrer.
--
-- UPDATE public.organizations SET plan = 'pro', plan_periode = 'annuel'
-- WHERE name = 'NOM DE L ENTREPRISE';
--
-- NOTE PERSONNELLE — renseigner plan_note dans la meme edition ; le
-- trigger ne remplace que celles qu'il a lui-meme ecrites.
--
-- UPDATE public.organizations
-- SET plan = 'pro', plan_note = 'Airtel Money 21/09, capture par mail'
-- WHERE name = 'NOM DE L ENTREPRISE';
--
-- RENOUVELER — la formule ne change pas, il n'y a que la date a pousser.
-- Repartir de la date de fin en cours, et non de CURRENT_DATE, sinon un
-- client qui paie en avance perd les jours qui lui restaient.
--
-- UPDATE public.organizations
-- SET plan_expire_le = (GREATEST(plan_expire_le, CURRENT_DATE) + INTERVAL '1 month')::date,
--     plan_note      = 'Renouvellement Airtel Money du ...'
-- WHERE name = 'NOM DE L ENTREPRISE';
--
-- REDESCENDRE — mettre `plan` a 'essentiel' ; le trigger vide les dates.

-- ------------------------------------------------------------
-- ABONNEMENTS SANS DATE DE FIN (doit renvoyer 0 ligne)
-- ------------------------------------------------------------
-- SELECT name, plan, plan_periode FROM public.organizations
-- WHERE plan <> 'essentiel' AND plan_expire_le IS NULL;

-- ------------------------------------------------------------
-- VOIR QUI PAYE QUOI
-- ------------------------------------------------------------
-- SELECT name, plan, plan_periode, plan_expire_le, plan_note
-- FROM public.organizations
-- ORDER BY plan DESC, name;
