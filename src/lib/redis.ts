import IORedis from "ioredis";

let redisConnection: IORedis | undefined;
let redisErrorLogged = false;

export function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL is not defined");
  }

  if (!redisConnection) {
    redisConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    redisConnection.on("error", (error) => {
      if (!redisErrorLogged) {
        console.error("[redis] Connection unavailable:", error.message);
        redisErrorLogged = true;
      }
    });
    redisConnection.on("ready", () => {
      redisErrorLogged = false;
    });
  }

  return redisConnection;
}
