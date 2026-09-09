# DNS-AID records for stack.perkos.xyz

DNS for AI Discovery (DNS-AID) lets agents find Stack's endpoints through DNS, under the `_agents` namespace. The zone `perkos.xyz` is on Route 53, so these are the records to add. Nothing else in the app depends on them; the HTTP discovery files work without DNS.

## Records

| Name | Type | Value |
|---|---|---|
| `_index._agents.stack.perkos.xyz` | TXT | `"v=aid1; a2a=_a2a._agents.stack.perkos.xyz; mcp=_mcp._agents.stack.perkos.xyz; catalog=https://stack.perkos.xyz/.well-known/ai-catalog.json"` |
| `_a2a._agents.stack.perkos.xyz` | HTTPS | `1 stack.perkos.xyz. alpn="h2,a2a" port="443" key65000="/api/a2a"` |
| `_mcp._agents.stack.perkos.xyz` | HTTPS | `1 stack.perkos.xyz. alpn="h2,mcp" port="443" key65000="/mcp"` |
| `_catalog._agents.stack.perkos.xyz` | TXT | `"url=https://stack.perkos.xyz/.well-known/ai-catalog.json"` |

`key65000` carries the endpoint path as an experimental SvcParam until DNS-AID registers a named key.

## Route 53 change batch

Save as `dns-aid.json`, replace `ZONEID` with the hosted zone id of `perkos.xyz`:

```json
{
  "Comment": "DNS-AID for stack.perkos.xyz",
  "Changes": [
    { "Action": "UPSERT", "ResourceRecordSet": { "Name": "_index._agents.stack.perkos.xyz", "Type": "TXT", "TTL": 3600,
      "ResourceRecords": [ { "Value": "\"v=aid1; a2a=_a2a._agents.stack.perkos.xyz; mcp=_mcp._agents.stack.perkos.xyz; catalog=https://stack.perkos.xyz/.well-known/ai-catalog.json\"" } ] } },
    { "Action": "UPSERT", "ResourceRecordSet": { "Name": "_a2a._agents.stack.perkos.xyz", "Type": "HTTPS", "TTL": 3600,
      "ResourceRecords": [ { "Value": "1 stack.perkos.xyz. alpn=\"h2,a2a\" port=\"443\" key65000=\"/api/a2a\"" } ] } },
    { "Action": "UPSERT", "ResourceRecordSet": { "Name": "_mcp._agents.stack.perkos.xyz", "Type": "HTTPS", "TTL": 3600,
      "ResourceRecords": [ { "Value": "1 stack.perkos.xyz. alpn=\"h2,mcp\" port=\"443\" key65000=\"/mcp\"" } ] } },
    { "Action": "UPSERT", "ResourceRecordSet": { "Name": "_catalog._agents.stack.perkos.xyz", "Type": "TXT", "TTL": 3600,
      "ResourceRecords": [ { "Value": "\"url=https://stack.perkos.xyz/.well-known/ai-catalog.json\"" } ] } }
  ]
}
```

```bash
aws route53 change-resource-record-sets --hosted-zone-id ZONEID --change-batch file://dns-aid.json
```

If the console or CLI rejects `HTTPS` as a record type, use `SVCB` with the same value: Route 53 supports both.

## Verify

```bash
dig +short TXT _index._agents.stack.perkos.xyz
dig +short HTTPS _a2a._agents.stack.perkos.xyz
dig +short HTTPS _mcp._agents.stack.perkos.xyz
```

Then re-run the scan: `POST https://isitagentready.com/api/scan` with `{"url":"https://stack.perkos.xyz"}` and check `checks.discoverability.dnsAid.status`. DNSSEC on the zone is a separate, optional step (the scanner reports it but does not require it).
