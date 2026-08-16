-- ============================================================
-- Catalogue d'articles / services par organisation
-- ------------------------------------------------------------
-- Remplace la liste stockee dans le localStorage du navigateur
-- (ogoue.ventes.articles.<userId>), qui etait propre a chaque
-- utilisateur et sans prix. Le catalogue devient partage par
-- toute l'organisation et porte un prix unitaire.
--
-- A executer dans Supabase : Dashboard > SQL Editor > New query
-- ============================================================

CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    -- 'produits' ou 'services' : mêmes valeurs que sales.sale_type
    type VARCHAR(50) NOT NULL DEFAULT 'produits',
    -- Prix a l'unite. Le montant total d'une vente vaut
    -- unit_price x quantity, et reste modifiable au cas par cas.
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Recherche des articles d'une organisation
CREATE INDEX IF NOT EXISTS idx_articles_organization_id ON articles(organization_id);

-- Coeur de l'harmonisation : interdit deux articles actifs de meme nom
-- dans une meme organisation, sans tenir compte de la casse.
-- "Robe" et "robe" ne peuvent donc plus coexister.
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_org_name_unique
    ON articles (organization_id, lower(name))
    WHERE is_active;

-- RLS activee : l'API backend utilise la cle service_role, qui
-- contourne RLS. Aucune politique publique n'est donc ouverte ici,
-- ce qui empeche tout acces direct depuis un client anon.
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
