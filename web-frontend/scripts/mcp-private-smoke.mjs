#!/usr/bin/env node
import { runPrivateMcpProbe } from '../server/private-mcp.mjs';

const probe = await runPrivateMcpProbe();
process.stdout.write(`${JSON.stringify(probe, null, 2)}\n`);
if (!probe.ok) {
  process.stderr.write(`KNOUX private MCP proof incomplete: ${probe.error?.code || 'UNKNOWN'} ${probe.error?.message || ''}\n`);
  process.exitCode = 2;
}
