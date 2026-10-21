# Fjordbok MCP-server

Lar en AI-agent (Claude Desktop, Claude Code m.fl.) hjelpe til med bokføring. Agenten kan **bare foreslå**;
du godkjenner i Fjordbok under *Forslag fra AI*. Se `docs/AI-AGENTER.md`.

1. Opprett en agentnøkkel i Fjordbok: *Forslag fra AI → Koble til en AI-agent*.
2. Legg serveren til hos agenten, f.eks. i Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "fjordbok": {
      "command": "node",
      "args": ["/sti/til/norsk-regnskap/mcp/fjordbok-mcp.mjs"],
      "env": {
        "FJORDBOK_URL": "https://<prosjekt>.supabase.co",
        "FJORDBOK_PUBLIC_KEY": "<offentlig nøkkel, VITE_SUPABASE_PUBLISHABLE_KEY>",
        "FJORDBOK_AGENT_KEY": "fbk_…"
      }
    }
  }
}
```

Verktøy: `hent_kontoplan`, `hent_banktransaksjoner`, `foreslaa_bilag`. Ingen avhengigheter, Node 18+.
Tilgangen begrenses av nøkkelen i databasen, ikke av serveren. Kall nøkkelen tilbake i Fjordbok hvis den lekker.
