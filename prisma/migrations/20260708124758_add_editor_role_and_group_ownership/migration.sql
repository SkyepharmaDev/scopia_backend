-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'EDITOR';

-- AlterTable
ALTER TABLE "queries" ADD COLUMN     "owner_group_id" TEXT;

-- AlterTable
ALTER TABLE "user_groups" ADD COLUMN     "can_edit" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "queries" ADD CONSTRAINT "queries_owner_group_id_fkey" FOREIGN KEY ("owner_group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
