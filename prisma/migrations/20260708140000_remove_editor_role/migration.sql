-- Rebascule les éditeurs vers USER : le statut d'éditeur est désormais porté
-- uniquement par l'appartenance à un groupe (user_groups.can_edit).
UPDATE "users" SET "role" = 'USER' WHERE "role" = 'EDITOR';

-- Recrée l'enum Role sans la valeur EDITOR (Postgres ne permet pas de
-- supprimer une valeur d'enum directement).
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';
DROP TYPE "Role_old";
