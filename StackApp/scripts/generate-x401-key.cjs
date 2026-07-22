const { generateKeyPairSync } = require("node:crypto");

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
process.stdout.write(`${JSON.stringify(privateKey.export({ format: "jwk" }))}\n`);
