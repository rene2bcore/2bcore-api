-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "request_id" VARCHAR(128) NOT NULL,
    "model" VARCHAR(64) NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "estimated_cost_usd" DOUBLE PRECISION NOT NULL,
    "stream" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_logs_user_id_idx" ON "ai_usage_logs"("user_id");

-- CreateIndex
CREATE INDEX "ai_usage_logs_created_at_idx" ON "ai_usage_logs"("created_at");

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
