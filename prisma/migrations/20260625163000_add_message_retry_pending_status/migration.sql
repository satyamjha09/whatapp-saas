-- Add an intermediate status for BullMQ retryable send failures.
ALTER TYPE "MessageStatus" ADD VALUE 'RETRY_PENDING' AFTER 'SENDING';
