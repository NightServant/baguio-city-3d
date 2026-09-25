CREATE TABLE "corrections" (
  "id" BIGSERIAL NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "page_path" TEXT NOT NULL CHECK (char_length("page_path") BETWEEN 1 AND 200),
  "message" TEXT NOT NULL CHECK (char_length("message") BETWEEN 10 AND 2000),
  "reply_email" TEXT CHECK ("reply_email" IS NULL OR char_length("reply_email") <= 254),
  "resolved_at" TIMESTAMPTZ(6),
  CONSTRAINT "corrections_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "corrections_created_at_idx" ON "corrections"("created_at");
