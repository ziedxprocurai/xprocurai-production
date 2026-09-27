-- RFQ Quote workflow extension
-- Extends the xDiscovery Beta "Request a Quote" flow:
--   * new nullable columns on public.rfqs (category, item_name, unit_of_measure)
--   * public.rfq_attachments: metadata for spec files uploaded to Supabase Storage
--   * public.rfq_quotes: one recorded supplier quotation per RFQ
-- Generated from `prisma migrate diff` between the previous and current
-- datamodel, then made idempotent so the file can be re-applied safely.

-- CreateEnum
DO $$
BEGIN
    CREATE TYPE "public"."RFQUnitOfMeasure" AS ENUM ('PIECE', 'KG', 'TONNE', 'METRE', 'LITRE', 'PALETTE', 'HOUR', 'FLAT_RATE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "public"."rfqs" ADD COLUMN IF NOT EXISTS "category" TEXT,
ADD COLUMN IF NOT EXISTS "item_name" TEXT,
ADD COLUMN IF NOT EXISTS "unit_of_measure" "public"."RFQUnitOfMeasure";

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."rfq_attachments" (
    "id" TEXT NOT NULL,
    "rfq_id" TEXT NOT NULL,
    "storage_bucket" TEXT NOT NULL DEFAULT 'rfq-attachments',
    "storage_path" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rfq_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."rfq_quotes" (
    "id" TEXT NOT NULL,
    "rfq_id" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "unit_price" DECIMAL(14,4) NOT NULL,
    "total_price" DECIMAL(16,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "delivery_time_days" INTEGER,
    "lead_time_days" INTEGER,
    "payment_terms" TEXT,
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "valid_until" DATE,
    "notes" TEXT,
    "recorded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rfq_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rfq_attachments_rfq_id_idx" ON "public"."rfq_attachments"("rfq_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rfq_attachments_storage_path_idx" ON "public"."rfq_attachments"("storage_path");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "rfq_quotes_rfq_id_key" ON "public"."rfq_quotes"("rfq_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rfq_attachments_rfq_id_fkey') THEN
        ALTER TABLE "public"."rfq_attachments" ADD CONSTRAINT "rfq_attachments_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rfq_attachments_uploaded_by_id_fkey') THEN
        ALTER TABLE "public"."rfq_attachments" ADD CONSTRAINT "rfq_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rfq_quotes_rfq_id_fkey') THEN
        ALTER TABLE "public"."rfq_quotes" ADD CONSTRAINT "rfq_quotes_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rfq_quotes_recorded_by_id_fkey') THEN
        ALTER TABLE "public"."rfq_quotes" ADD CONSTRAINT "rfq_quotes_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- RLS: enabled with no policies for anon/authenticated (deny-by-default).
-- The app accesses these tables server-side via Prisma using the
-- owner/postgres role, which bypasses RLS.
ALTER TABLE "public"."rfq_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rfq_quotes" ENABLE ROW LEVEL SECURITY;

-- Private storage bucket for RFQ spec attachments. No-op on plain Postgres
-- (no `storage` schema); on Supabase the bucket is service-role only, so no
-- storage.objects policies are defined here.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit)
        VALUES ('rfq-attachments', 'rfq-attachments', false, 26214400)
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;
