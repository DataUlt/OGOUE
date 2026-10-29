-- Heure de la dernière modification d'une vente et d'une dépense.
-- created_at reste la date d'enregistrement : c'est elle qui fixe la fenêtre de 24 h.
-- A EXECUTER UNE FOIS dans Supabase > SQL Editor, sur le projet PRINCIPAL (mqbenehogdrmywhbxjhz).

ALTER TABLE sales ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ;

-- Raison (courte) de la dernière modification : obligatoire à chaque modification.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS modified_reason VARCHAR(120);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS modified_reason VARCHAR(120);
