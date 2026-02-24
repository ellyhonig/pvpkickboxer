# MCP Unity Setup (Done + Remaining)

## Done (by CLI)
- Cloned `mcp-unity` to `tools/mcp-unity`.
- Installed server dependencies and built Node server output.
- Added Codex MCP entry in `C:\Users\ellyh\.codex\config.toml`:
  - `[mcp_servers.mcp-unity]`
  - `command = "node"`
  - `args = ["X:/pvpkickboxer/tools/mcp-unity/Server~/build/index.js"]`
- Added helper starter script: `tools/start_mcp_unity.ps1`.

## One-Time Unity Editor Steps (you do in Unity)
1. Open your Unity project.
2. Package Manager -> Add package from git URL:
   - `https://github.com/CoderGamester/mcp-unity.git`
3. Unity menu: `Tools > MCP Unity > Server Window`.
4. Click `Start Server`.
5. Keep Unity open while Codex uses MCP tools.

## Optional
- If Unity server is on a custom port, run:
  - `.\tools\start_mcp_unity.ps1 -Port 8091`
- If remote host needed:
  - `.\tools\start_mcp_unity.ps1 -HostName 192.168.x.x`

## Verify
- In Unity MCP Server Window, connected client should appear.
- In Codex, MCP Unity tools become available for scene/object operations.
