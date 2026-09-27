-- RFQ Graph email workflow
-- Adds real emailing via Microsoft Graph on top of the xDiscovery Beta RFQ
-- flow:
--   * public.rfqs gains per-user ownership (user_id), a public reference,
--     the full request payload + commercial terms, and email pipeline state.
--   * public.rfq_messages / public.rfq_message_attachments store the outbound
--     RFQ email and captured inbound replies (conversation thread).
--   * public.graph_subscriptions tracks the Graph Inbox webhook subscription.
-- Generated from `prisma migrate diff` between the previous and current
-- datamodel, then made idempotent so the file can be re-applied safely.

-- CreateEnum
DO $$
BEGIN
    CREATE TYPE "public"."RFQEmailStatus" AS ENUM ('QUEUED', 'SENT', 'WAITING_REPLY', 'REPLIED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
    CREATE TYPE "public"."RFQMessageDirection" AS ENUM ('OUTBOUND', 'INBOUND');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
    CREATE TYPE "public"."RFQMessageKind" AS ENUM ('RFQ_REQUEST', 'REPLY', 'AUTO_REPLY', 'BOUNCE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "public"."rfqs" ADD COLUMN IF NOT EXISTS "additional_requirements" TEXT,
ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3),
ADD COLUMN IF NOT EXISTS "delivery_location" TEXT,
ADD COLUMN IF NOT EXISTS "email_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "email_error" TEXT,
ADD COLUMN IF NOT EXISTS "email_sent_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "email_status" "public"."RFQEmailStatus",
ADD COLUMN IF NOT EXISTS "graph_conversation_id" TEXT,
ADD COLUMN IF NOT EXISTS "graph_internet_message_id" TEXT,
ADD COLUMN IF NOT EXISTS "graph_message_id" TEXT,
ADD COLUMN IF NOT EXISTS "incoterm" TEXT,
ADD COLUMN IF NOT EXISTS "last_reply_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "payment_terms" TEXT,
ADD COLUMN IF NOT EXISTS "reference" TEXT,
ADD COLUMN IF NOT EXISTS "request_payload" JSONB,
ADD COLUMN IF NOT EXISTS "required_delivery_date" DATE,
ADD COLUMN IF NOT EXISTS "target_budget" DECIMAL(16,2),
ADD COLUMN IF NOT EXISTS "user_id" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."rfq_messages" (
    "id" TEXT NOT NULL,
    "rfq_id" TEXT NOT NULL,
    "user_id" TEXT,
    "direction" "public"."RFQMessageDirection" NOT NULL,
    "kind" "public"."RFQMessageKind" NOT NULL,
    "graph_message_id" TEXT NOT NULL,
    "internet_message_id" TEXT,
    "conversation_id" TEXT,
    "in_reply_to" TEXT,
    "subject" TEXT,
    "from_email" TEXT,
    "from_name" TEXT,
    "to_recipients" JSONB,
    "cc_recipients" JSONB,
    "body_text" TEXT,
    "body_html" TEXT,
    "sent_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "has_attachments" BOOLEAN NOT NULL DEFAULT false,
    "matched_by" TEXT,
    "sender_matches_supplier" BOOLEAN,
    "graph_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rfq_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."rfq_message_attachments" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "rfq_id" TEXT NOT NULL,
    "user_id" TEXT,
    "graph_message_id" TEXT NOT NULL,
    "graph_attachment_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT,
    "size" INTEGER NOT NULL,
    "is_inline" BOOLEAN NOT NULL DEFAULT false,
    "attachment_type" TEXT NOT NULL,
    "content_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rfq_message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."graph_subscriptions" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "change_type" TEXT NOT NULL,
    "notification_url" TEXT NOT NULL,
    "expiration_date_time" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "graph_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "rfq_messages_graph_message_id_key" ON "public"."rfq_messages"("graph_message_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rfq_messages_rfq_id_idx" ON "public"."rfq_messages"("rfq_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rfq_messages_user_id_idx" ON "public"."rfq_messages"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rfq_messages_conversation_id_idx" ON "public"."rfq_messages"("conversation_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rfq_messages_internet_message_id_idx" ON "public"."rfq_messages"("internet_message_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rfq_message_attachments_rfq_id_idx" ON "public"."rfq_message_attachments"("rfq_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "rfq_message_attachments_graph_message_id_graph_attachment_i_key" ON "public"."rfq_message_attachments"("graph_message_id", "graph_attachment_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "rfqs_reference_key" ON "public"."rfqs"("reference");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rfqs_user_id_idx" ON "public"."rfqs"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rfqs_graph_conversation_id_idx" ON "public"."rfqs"("graph_conversation_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rfqs_graph_internet_message_id_idx" ON "public"."rfqs"("graph_internet_message_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rfqs_user_id_fkey') THEN
        ALTER TABLE "public"."rfqs" ADD CONSTRAINT "rfqs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rfq_messages_rfq_id_fkey') THEN
        ALTER TABLE "public"."rfq_messages" ADD CONSTRAINT "rfq_messages_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rfq_messages_user_id_fkey') THEN
        ALTER TABLE "public"."rfq_messages" ADD CONSTRAINT "rfq_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rfq_message_attachments_message_id_fkey') THEN
        ALTER TABLE "public"."rfq_message_attachments" ADD CONSTRAINT "rfq_message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."rfq_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rfq_message_attachments_rfq_id_fkey') THEN
        ALTER TABLE "public"."rfq_message_attachments" ADD CONSTRAINT "rfq_message_attachments_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rfq_message_attachments_user_id_fkey') THEN
        ALTER TABLE "public"."rfq_message_attachments" ADD CONSTRAINT "rfq_message_attachments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- RLS: enabled with no policies for anon/authenticated (deny-by-default).
-- The app accesses these tables server-side via Prisma using the
-- owner/postgres role, which bypasses RLS.
ALTER TABLE "public"."rfq_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rfq_message_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."graph_subscriptions" ENABLE ROW LEVEL SECURITY;

-- Backfill: assign legacy RFQ rows to their owner only when the buyer company
-- has exactly one user (unambiguous). Rows for multi-user companies stay
-- unassigned (invisible) — that is intentional.
UPDATE public.rfqs r
SET user_id = single.user_id
FROM (
  SELECT company_id, MIN(id) AS user_id
  FROM public.users
  WHERE company_id IS NOT NULL
  GROUP BY company_id
  HAVING COUNT(*) = 1
) single
WHERE r.user_id IS NULL AND r.buyer_id = single.company_id;
