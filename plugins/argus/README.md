# Argus Plugin

Install Node.js 22.12+ first. On macOS/Linux, choose one host or install both:

```bash
curl -fsSL https://raw.githubusercontent.com/microsoft/ArgusAgent/main/plugins/argus/install.sh | sh -s -- codex
curl -fsSL https://raw.githubusercontent.com/microsoft/ArgusAgent/main/plugins/argus/install.sh | sh -s -- claude
curl -fsSL https://raw.githubusercontent.com/microsoft/ArgusAgent/main/plugins/argus/install.sh | sh -s -- all
```

On Windows, download and run the installer from PowerShell:

```powershell
$Installer = Join-Path $env:TEMP "argus-plugin-install.ps1"
Invoke-WebRequest `
  https://raw.githubusercontent.com/microsoft/ArgusAgent/main/plugins/argus/install.ps1 `
  -OutFile $Installer
& $Installer all
Remove-Item $Installer
```

Replace `all` with `codex` or `claude` to install one host. The Windows
installer uses the system `py` installation and does not create a virtual
environment. The bundled MCP launcher uses Node.js to select the
platform-appropriate Argus Python.

After installation, ask Codex or Claude Code to run a project with Argus, show
the Argus project status, or invoke `target-disease-research`. The built-in
`medical` vertical supports research, not diagnosis or treatment advice.
