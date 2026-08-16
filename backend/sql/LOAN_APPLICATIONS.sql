-- ============================================================
-- Dossiers de financement — base SECONDAIRE (PFE-OGOUE-FINANCEMENT)
-- ------------------------------------------------------------
-- A executer sur le projet Supabase zfzjvjpzszayrwsnblao,
-- PAS sur la base principale.
--   Dashboard > SQL Editor > New query
--
-- Complete l'existant : institutions et credit_products decrivent
-- l'offre, product_required_documents les pieces exigees. Il manquait
-- de quoi porter le dossier lui-meme, ses pieces et son avancement.
-- ============================================================

-- ── Dossier de financement ─────────────────────────────────
CREATE TABLE IF NOT EXISTS loan_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pme_id UUID NOT NULL,
    credit_product_id UUID NOT NULL,
    institution_id UUID NOT NULL,

    -- brouillon | depose | en_examen | complement_requis | accepte | refuse
    status VARCHAR(30) NOT NULL DEFAULT 'brouillon',

    amount_requested NUMERIC(14, 2),
    duration_months INTEGER,
    purpose TEXT,

    submitted_at TIMESTAMP,
    decided_at TIMESTAMP,
    decision_note TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (pme_id) REFERENCES pmes(id) ON DELETE CASCADE,
    FOREIGN KEY (credit_product_id) REFERENCES credit_products(id),
    FOREIGN KEY (institution_id) REFERENCES institutions(id)
);

CREATE INDEX IF NOT EXISTS idx_loan_applications_pme ON loan_applications(pme_id);
CREATE INDEX IF NOT EXISTS idx_loan_applications_institution ON loan_applications(institution_id);
CREATE INDEX IF NOT EXISTS idx_loan_applications_status ON loan_applications(status);

-- Une PME ne peut pas avoir deux dossiers en cours sur le meme produit.
-- Les dossiers clos (accepte / refuse) ne bloquent pas une nouvelle demande.
CREATE UNIQUE INDEX IF NOT EXISTS idx_loan_applications_en_cours
    ON loan_applications (pme_id, credit_product_id)
    WHERE status IN ('brouillon', 'depose', 'en_examen', 'complement_requis');

-- ── Pieces jointes au dossier ──────────────────────────────
CREATE TABLE IF NOT EXISTS application_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    -- Rattache la piece a l'exigence du produit quand elle en decoule
    required_document_id UUID,
    name VARCHAR(255) NOT NULL,
    file_url TEXT,
    storage_path TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (application_id) REFERENCES loan_applications(id) ON DELETE CASCADE,
    FOREIGN KEY (required_document_id) REFERENCES product_required_documents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_application_documents_dossier
    ON application_documents(application_id);

-- ── Historique d'avancement ────────────────────────────────
-- C'est ce qui permet a la PME de suivre l'evolution de son dossier
-- plutot que de ne voir qu'un statut courant sans contexte.
CREATE TABLE IF NOT EXISTS application_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL,
    note TEXT,
    -- Qui a provoque le changement : 'pme' ou 'institution'
    changed_by VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (application_id) REFERENCES loan_applications(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_application_status_history_dossier
    ON application_status_history(application_id, created_at);

-- RLS activee : l'API backend utilise la cle service_role, qui la
-- contourne. Aucune politique publique n'est ouverte, ce qui empeche
-- tout acces direct depuis un client anon.
ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_status_history ENABLE ROW LEVEL SECURITY;
