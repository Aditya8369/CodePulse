# @codepulse/sdk (v1.0.0)

Official TypeScript SDK generated from OpenAPI 3.1.0.

## Usage
```ts
import { CodePulseClient } from "@codepulse/sdk";

const client = new CodePulseClient({ bearerToken: process.env.CODEPULSE_TOKEN });
const profile = await client.getDeveloperByUsername("Itssonia7");
```
