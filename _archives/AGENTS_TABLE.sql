-- Créer la table agents
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    access_code VARCHAR(32) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Index sur organization_id pour les requêtes rapides
CREATE INDEX IF NOT EXISTS idx_agents_organization_id ON agents(organization_id);

-- Index sur access_code pour les authentifications
CREATE INDEX IF NOT EXISTS idx_agents_access_code ON agents(access_code);

-- RLS Policy: Les agents ne peuvent voir que leurs propres infos (optionnel)
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Politique pour les Gérants: voir tous leurs agents
CREATE POLICY "Gerants can view their agents" ON agents
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_id = auth.uid()
        )
    );

-- Politique pour créer des agents
CREATE POLICY "Gerants can create agents" ON agents
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_id = auth.uid()
        )
    );

-- Politique pour supprimer des agents
CREATE POLICY "Gerants can delete their agents" ON agents
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_id = auth.uid()
        )
    );

-- Politique pour mettre à jour des agents
CREATE POLICY "Gerants can update their agents" ON agents
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_id = auth.uid()
        )
    );
