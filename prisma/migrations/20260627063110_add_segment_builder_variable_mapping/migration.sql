-- CreateEnum
CREATE TYPE "ContactSegmentStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ContactSegmentMatchMode" AS ENUM ('ALL', 'ANY');

-- CreateEnum
CREATE TYPE "ContactSegmentRuleField" AS ENUM ('PHONE', 'NAME', 'EMAIL', 'SOURCE', 'CITY', 'TAG', 'MARKETING_CONSENT', 'UTILITY_CONSENT', 'CREATED_AT', 'LAST_MESSAGE_AT', 'CUSTOM_FIELD');

-- CreateEnum
CREATE TYPE "ContactSegmentRuleOperator" AS ENUM ('EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'IN', 'NOT_IN', 'EXISTS', 'NOT_EXISTS', 'BEFORE', 'AFTER', 'BETWEEN');

-- CreateEnum
CREATE TYPE "TemplateVariableMappingStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "TemplateVariableMappingSource" AS ENUM ('CONTACT_FIELD', 'CUSTOM_FIELD', 'STATIC_VALUE', 'SYSTEM_VALUE');

-- CreateTable
CREATE TABLE "ContactSegment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "status" "ContactSegmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "matchMode" "ContactSegmentMatchMode" NOT NULL DEFAULT 'ALL',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "lastPreviewCount" INTEGER NOT NULL DEFAULT 0,
    "lastPreviewAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactSegmentRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "field" "ContactSegmentRuleField" NOT NULL,
    "operator" "ContactSegmentRuleOperator" NOT NULL,
    "customFieldKey" TEXT,
    "value" TEXT,
    "values" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactSegmentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactSegmentPreview" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "totalMatched" INTEGER NOT NULL DEFAULT 0,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "sampleContactIds" JSONB,
    "sampleContacts" JSONB,
    "generatedByUserId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "ContactSegmentPreview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateVariableMapping" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "status" "TemplateVariableMappingStatus" NOT NULL DEFAULT 'ACTIVE',
    "templateId" TEXT,
    "templateName" TEXT NOT NULL,
    "templateLanguage" TEXT,
    "segmentId" TEXT,
    "variableKey" TEXT NOT NULL,
    "source" "TemplateVariableMappingSource" NOT NULL,
    "contactField" TEXT,
    "customFieldKey" TEXT,
    "staticValue" TEXT,
    "systemValueKey" TEXT,
    "fallbackValue" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateVariableMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactSegment_companyId_idx" ON "ContactSegment"("companyId");

-- CreateIndex
CREATE INDEX "ContactSegment_createdByUserId_idx" ON "ContactSegment"("createdByUserId");

-- CreateIndex
CREATE INDEX "ContactSegment_status_idx" ON "ContactSegment"("status");

-- CreateIndex
CREATE INDEX "ContactSegment_matchMode_idx" ON "ContactSegment"("matchMode");

-- CreateIndex
CREATE INDEX "ContactSegment_createdAt_idx" ON "ContactSegment"("createdAt");

-- CreateIndex
CREATE INDEX "ContactSegmentRule_companyId_idx" ON "ContactSegmentRule"("companyId");

-- CreateIndex
CREATE INDEX "ContactSegmentRule_segmentId_idx" ON "ContactSegmentRule"("segmentId");

-- CreateIndex
CREATE INDEX "ContactSegmentRule_field_idx" ON "ContactSegmentRule"("field");

-- CreateIndex
CREATE INDEX "ContactSegmentRule_operator_idx" ON "ContactSegmentRule"("operator");

-- CreateIndex
CREATE INDEX "ContactSegmentRule_customFieldKey_idx" ON "ContactSegmentRule"("customFieldKey");

-- CreateIndex
CREATE INDEX "ContactSegmentRule_createdAt_idx" ON "ContactSegmentRule"("createdAt");

-- CreateIndex
CREATE INDEX "ContactSegmentPreview_companyId_idx" ON "ContactSegmentPreview"("companyId");

-- CreateIndex
CREATE INDEX "ContactSegmentPreview_segmentId_idx" ON "ContactSegmentPreview"("segmentId");

-- CreateIndex
CREATE INDEX "ContactSegmentPreview_generatedByUserId_idx" ON "ContactSegmentPreview"("generatedByUserId");

-- CreateIndex
CREATE INDEX "ContactSegmentPreview_generatedAt_idx" ON "ContactSegmentPreview"("generatedAt");

-- CreateIndex
CREATE INDEX "TemplateVariableMapping_companyId_idx" ON "TemplateVariableMapping"("companyId");

-- CreateIndex
CREATE INDEX "TemplateVariableMapping_createdByUserId_idx" ON "TemplateVariableMapping"("createdByUserId");

-- CreateIndex
CREATE INDEX "TemplateVariableMapping_templateId_idx" ON "TemplateVariableMapping"("templateId");

-- CreateIndex
CREATE INDEX "TemplateVariableMapping_templateName_idx" ON "TemplateVariableMapping"("templateName");

-- CreateIndex
CREATE INDEX "TemplateVariableMapping_templateLanguage_idx" ON "TemplateVariableMapping"("templateLanguage");

-- CreateIndex
CREATE INDEX "TemplateVariableMapping_segmentId_idx" ON "TemplateVariableMapping"("segmentId");

-- CreateIndex
CREATE INDEX "TemplateVariableMapping_variableKey_idx" ON "TemplateVariableMapping"("variableKey");

-- CreateIndex
CREATE INDEX "TemplateVariableMapping_source_idx" ON "TemplateVariableMapping"("source");

-- CreateIndex
CREATE INDEX "TemplateVariableMapping_status_idx" ON "TemplateVariableMapping"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateVariableMapping_companyId_templateName_templateLang_key" ON "TemplateVariableMapping"("companyId", "templateName", "templateLanguage", "segmentId", "variableKey");

-- AddForeignKey
ALTER TABLE "ContactSegment" ADD CONSTRAINT "ContactSegment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactSegment" ADD CONSTRAINT "ContactSegment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactSegmentRule" ADD CONSTRAINT "ContactSegmentRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactSegmentRule" ADD CONSTRAINT "ContactSegmentRule_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "ContactSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactSegmentPreview" ADD CONSTRAINT "ContactSegmentPreview_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactSegmentPreview" ADD CONSTRAINT "ContactSegmentPreview_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "ContactSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactSegmentPreview" ADD CONSTRAINT "ContactSegmentPreview_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateVariableMapping" ADD CONSTRAINT "TemplateVariableMapping_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateVariableMapping" ADD CONSTRAINT "TemplateVariableMapping_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateVariableMapping" ADD CONSTRAINT "TemplateVariableMapping_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "ContactSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
