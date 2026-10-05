-- A 0008 foi escrita à mão e ficou sem a chave estrangeira de page_visit.user_id.
-- Idempotente: só cria se ainda não existir, e limpa visitas de contas que já não existem.
UPDATE "page_visit" SET "user_id" = NULL WHERE "user_id" IS NOT NULL AND "user_id" NOT IN (SELECT "id" FROM "user");--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'page_visit_user_id_user_id_fk') THEN
    ALTER TABLE "page_visit" ADD CONSTRAINT "page_visit_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
