import { prisma } from "@/lib/prisma";
import { processDuePartnerClientProvisioningJobs } from "@/server/services/partner-client-provisioning.service";

async function main() {
  const actorEmail = process.env.PLATFORM_PROVISIONING_WORKER_ACTOR_EMAIL;

  if (!actorEmail) {
    throw new Error("PLATFORM_PROVISIONING_WORKER_ACTOR_EMAIL is required.");
  }

  const actor = await prisma.user.findUnique({
    where: {
      email: actorEmail.toLowerCase(),
    },
    select: {
      id: true,
    },
  });

  if (!actor) {
    throw new Error(`Worker actor user not found: ${actorEmail}`);
  }

  const result = await processDuePartnerClientProvisioningJobs({
    actorUserId: actor.id,
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
