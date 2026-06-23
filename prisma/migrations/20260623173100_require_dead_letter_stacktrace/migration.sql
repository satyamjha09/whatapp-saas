-- Keep the database constraint aligned with the non-null Prisma list field.
ALTER TABLE "DeadLetterJob"
ALTER COLUMN "stacktrace" SET NOT NULL;
