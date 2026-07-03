-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContactSegmentRuleField" ADD VALUE 'COMPANY_NAME';
ALTER TYPE "ContactSegmentRuleField" ADD VALUE 'OPTED_OUT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContactSegmentRuleOperator" ADD VALUE 'IN_LAST_DAYS';
ALTER TYPE "ContactSegmentRuleOperator" ADD VALUE 'NOT_IN_LAST_DAYS';
ALTER TYPE "ContactSegmentRuleOperator" ADD VALUE 'IS_TRUE';
ALTER TYPE "ContactSegmentRuleOperator" ADD VALUE 'IS_FALSE';
