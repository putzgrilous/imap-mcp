# imap-mcp

**Read, search, send, and organize your emails directly from Claude.**

`imap-mcp` is a local MCP server that connects Claude Desktop to any IMAP email account — Gmail, Outlook, corporate servers, and more. Your password never passes through the chat.

---

## Table of Contents

- [Quick Start (Windows .exe)](#quick-start-windows-exe)
- [Quick Start (Node.js / npm)](#quick-start-nodejs--npm)
- [Configuring Claude Desktop](#configuring-claude-desktop)
- [Adding Your First Email Account](#adding-your-first-email-account)
- [config.json Reference](#configjson-reference)
- [Available Tools](#available-tools)
- [Provider Setup Guides](#provider-setup-guides)
- [Security Model](#security-model)
- [Building from Source](#building-from-source)
- [README em Português](#readme-em-português)

---

## Quick Start (Windows .exe)

This is the recommended path for most users. No Node.js required.

**1. Download the latest release**

Go to the [Releases](../../releases) page and download `imap-mcp.exe`.

**2. Create a folder for the server**

```
C:\imap-mcp\
```

Place `imap-mcp.exe` inside it.

**3. Configure Claude Desktop**

Open Claude Desktop → **Settings** → **Developer** → **Edit Config**.

> This button opens the correct config file for your installation automatically — do not try to find the file manually, as the path differs depending on whether you installed Claude via the direct installer or the Microsoft Store.

Add the following to the JSON file (keep any existing content):

```json
{
  "mcpServers": {
    "imap": {
      "command": "C:\\imap-mcp\\imap-mcp.exe",
      "args": []
    }
  }
}
```

Adjust the path if you placed the `.exe` elsewhere.

**4. Restart Claude Desktop**

Fully quit and reopen Claude Desktop. The MCP server starts automatically.

**5. Add your first account**

In any Claude conversation, ask:

> "Set up my email account"

Claude will call the `setup_account` tool. A **password prompt will appear in the terminal window** that opens alongside Claude Desktop — type your password there. It never goes through the chat.

---

## Quick Start (Node.js / npm)

For developers who already have Node.js 20+ installed.

**1. Clone and build**

```bash
git clone https://github.com/your-username/imap-mcp.git
cd imap-mcp
npm install
npm run build
```

**2. Configure Claude Desktop**

Open Claude Desktop → **Settings** → **Developer** → **Edit Config** and add:

```json
{
  "mcpServers": {
    "imap": {
      "command": "node",
      "args": ["C:\\path\\to\\imap-mcp\\dist\\index.js"]
    }
  }
}
```

**3. Restart Claude Desktop and add your account** (same as step 4–5 above).

---

## Configuring Claude Desktop

### Finding the config file

Always use the built-in button: **Settings → Developer → Edit Config**.

If you need to find it manually:

| Installation method | Config file location |
|---|---|
| Direct installer (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Microsoft Store (Windows) | `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json` |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |

> The Microsoft Store path contains a package ID (`Claude_pzs8sxrjxfjjc`) that may change between versions. Always prefer the **Edit Config** button.

### Config file format

```json
{
  "mcpServers": {
    "imap": {
      "command": "C:\\imap-mcp\\imap-mcp.exe",
      "args": []
    }
  }
}
```

- The key `"imap"` is the server name shown in Claude Desktop — you can rename it.
- `"args"` can be left as an empty array.
- If you have other MCP servers, add `"imap"` as another entry inside `"mcpServers"`.

### After every config change

You must **fully quit and reopen** Claude Desktop for changes to take effect. On Windows, right-click the tray icon and choose Quit — closing the window is not enough.

---

## Adding Your First Email Account

Once the server is running, ask Claude in any conversation:

> "Set up my email account"  
> "Add my Gmail account"  
> "Configure dante@company.com"

Claude will call `setup_account`. A terminal window will open showing:

```
╔══════════════════════════════════════════════════════════════════╗
║  Your password is entered DIRECTLY in the terminal.             ║
║  It does NOT pass through this chat or Claude.                  ║
║  NEVER type your password in the chat window.                   ║
╚══════════════════════════════════════════════════════════════════╝
Password for you@example.com: ████████
```

Type your password there. Characters are shown as `*`. Press Enter.

> **Gmail and Outlook users:** You need an **App Password**, not your regular login password. See [Provider Setup Guides](#provider-setup-guides).

---

## config.json Reference

`imap-mcp` stores your account settings in `config.json`, located in the same folder as the `.exe` (or the project root when running from source).

You do not need to edit this file manually — use `setup_account`, `update_account`, and `remove_account` via Claude.

### Full structure

```json
{
  "version": 2,
  "locale": "en",
  "logLevel": "warn",
  "features": {
    "list_accounts": true,
    "list_folders": true,
    "list_emails": true,
    "search_emails": true,
    "get_email": true,
    "get_attachment": true,
    "setup_account": true,
    "remove_account": true,
    "update_account": true,
    "list_config": true,
    "mark_read": false,
    "flag_email": false,
    "move_email": false,
    "delete_email": false,
    "create_folder": false,
    "delete_folder": false,
    "send_email": false,
    "reply_email": false,
    "watch_folder": false
  },
  "accounts": [
    {
      "name": "Work Gmail",
      "email": "you@gmail.com",
      "host": "imap.gmail.com",
      "port": 993,
      "secure": true,
      "auth": { "type": "password" }
    }
  ]
}
```

### Feature flags

Write and send tools are **disabled by default** to prevent accidental data loss. Enable them explicitly:

```json
"features": {
  "send_email": true,
  "reply_email": true,
  "delete_email": true
}
```

### Locale

Set `"locale": "pt-BR"` for Portuguese responses, `"en"` for English (default).

---

## Available Tools

| Tool | Default | Description |
|---|---|---|
| `list_accounts` | ✅ | List configured accounts |
| `list_folders` | ✅ | List all folders/labels |
| `list_emails` | ✅ | List recent emails with pagination |
| `search_emails` | ✅ | Search by text, date, size, flags |
| `get_email` | ✅ | Read full email with body and attachments |
| `get_attachment` | ✅ | Download attachment as base64 |
| `setup_account` | ✅ | Add or update an account (password via terminal) |
| `remove_account` | ✅ | Remove an account |
| `update_account` | ✅ | Update host/port/name without changing password |
| `list_config` | ✅ | Show current configuration (no passwords) |
| `mark_read` | ❌ | Mark email as read or unread |
| `flag_email` | ❌ | Star or unstar an email |
| `move_email` | ❌ | Move email to another folder |
| `delete_email` | ❌ | Permanently delete an email |
| `create_folder` | ❌ | Create a new folder |
| `delete_folder` | ❌ | Delete a folder and its contents |
| `send_email` | ❌ | Send a new email |
| `reply_email` | ❌ | Reply to an email (headers set automatically) |
| `watch_folder` | ❌ | Watch for new emails via IMAP IDLE |

✅ = enabled by default · ❌ = must enable in `config.json`

---

## Provider Setup Guides

### Gmail

Gmail requires an **App Password** — your regular password will not work if you have 2-Step Verification enabled (which Google now enforces on most accounts).

1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Create a new App Password (name it "imap-mcp" or anything you like)
3. Copy the 16-character password shown
4. Use these settings when Claude asks:
   - **Host:** `imap.gmail.com`
   - **Port:** `993`
   - **Secure:** `true`
   - **Password:** the 16-character App Password (not your Google account password)

> You must also enable IMAP in Gmail: Settings → See all settings → Forwarding and POP/IMAP → Enable IMAP.

### Outlook / Microsoft 365

1. Go to [account.microsoft.com/security](https://account.microsoft.com/security) → Advanced security options → App passwords
2. Create a new App Password
3. Settings:
   - **Host:** `outlook.office365.com`
   - **Port:** `993`
   - **Secure:** `true`

### Yahoo Mail

1. Go to Yahoo Account Security → Generate App Password
2. Settings:
   - **Host:** `imap.mail.yahoo.com`
   - **Port:** `993`
   - **Secure:** `true`

### iCloud Mail

1. Go to [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords
2. Settings:
   - **Host:** `imap.mail.me.com`
   - **Port:** `993`
   - **Secure:** `true`

### Generic IMAP server (corporate, cPanel, etc.)

Ask your email provider or IT team for:
- IMAP hostname (e.g. `mail.company.com` or `imap.skymail.net.br`)
- Port (usually `993` with SSL, or `143` with STARTTLS)
- Whether SSL/TLS is required

---

## Security Model

- **Passwords are never stored in the chat.** The `setup_account` tool opens a terminal prompt. Claude cannot see what you type there.
- **Credential storage priority:**
  1. OS keychain (Windows Credential Manager, macOS Keychain) — used when available
  2. Environment variable `IMAP_PASSWORD_YOU_AT_EXAMPLE_COM`
  3. `config.json` plaintext — works but shows a warning at startup; migrate when possible
- **All connections use TLS** (`rejectUnauthorized: true`). Plain-text IMAP is not supported.
- **Logs go to stderr only.** MCP uses stdout for JSON-RPC; logs never corrupt the protocol.
- **No telemetry.** Zero external calls beyond your own email server.

---

## Building from Source

```bash
git clone https://github.com/your-username/imap-mcp.git
cd imap-mcp
npm install
npm run build        # compiles to dist/
npm run package      # builds imap-mcp.exe (Windows)
```

Requirements: Node.js 20+, npm 10+.

The build script uses extra memory to handle TypeScript compilation:
```
node --max-old-space-size=4096 node_modules/typescript/bin/tsc -p tsconfig.build.json
```
This is normal — do not replace it with a plain `tsc` call.

---

## Troubleshooting

**The server doesn't appear in Claude Desktop**
- Make sure you fully quit Claude Desktop (tray icon → Quit) and reopened it
- Check the path in `claude_desktop_config.json` — use double backslashes on Windows: `C:\\imap-mcp\\imap-mcp.exe`
- Open **Settings → Developer** and check if the server shows an error

**"No accounts configured" message**
- The server started successfully. Ask Claude to "set up my email account" to add the first account.

**Password prompt doesn't appear**
- The terminal window may be behind other windows. Check the taskbar.
- On Windows, the prompt appears in the terminal that Claude Desktop uses to run the server — it may be minimized.

**Gmail: authentication failed**
- You must use an App Password, not your regular Gmail password. See [Gmail setup](#gmail).
- IMAP must be enabled in Gmail settings.

**Connection refused / timeout**
- Verify the IMAP host and port with your email provider.
- Check if a firewall is blocking outbound port 993.

---

---

# README em Português

**Leia, pesquise, envie e organize seus emails diretamente pelo Claude.**

`imap-mcp` é um servidor MCP local que conecta o Claude Desktop a qualquer conta de email IMAP — Gmail, Outlook, servidores corporativos e mais. Sua senha nunca passa pelo chat.

---

## Índice

- [Início rápido (Windows .exe)](#início-rápido-windows-exe)
- [Início rápido (Node.js / npm)](#início-rápido-nodejs--npm)
- [Configurando o Claude Desktop](#configurando-o-claude-desktop)
- [Adicionando sua primeira conta](#adicionando-sua-primeira-conta)
- [Referência do config.json](#referência-do-configjson)
- [Ferramentas disponíveis](#ferramentas-disponíveis)
- [Guias por provedor](#guias-por-provedor)
- [Modelo de segurança](#modelo-de-segurança)
- [Compilando do código-fonte](#compilando-do-código-fonte)

---

## Início rápido (Windows .exe)

Este é o caminho recomendado para a maioria dos usuários. Não precisa de Node.js.

**1. Baixe a versão mais recente**

Acesse a página de [Releases](../../releases) e baixe o `imap-mcp.exe`.

**2. Crie uma pasta para o servidor**

```
C:\imap-mcp\
```

Coloque o `imap-mcp.exe` dentro dela.

**3. Configure o Claude Desktop**

Abra o Claude Desktop → **Configurações** → **Desenvolvedor** → **Editar Config**.

> Este botão abre automaticamente o arquivo correto para a sua instalação — não tente encontrar o arquivo manualmente, pois o caminho é diferente dependendo se você instalou o Claude pelo instalador direto ou pela Microsoft Store.

Adicione o seguinte ao arquivo JSON (mantenha qualquer conteúdo existente):

```json
{
  "mcpServers": {
    "imap": {
      "command": "C:\\imap-mcp\\imap-mcp.exe",
      "args": []
    }
  }
}
```

Ajuste o caminho se colocou o `.exe` em outro lugar.

**4. Reinicie o Claude Desktop**

Feche completamente e reabra o Claude Desktop. O servidor MCP inicia automaticamente.

**5. Adicione sua primeira conta**

Em qualquer conversa com o Claude, diga:

> "Configure minha conta de email"

O Claude chamará a ferramenta `setup_account`. **Uma janela de terminal abrirá** — digite sua senha lá. Ela nunca passa pelo chat.

---

## Início rápido (Node.js / npm)

Para desenvolvedores que já têm o Node.js 20+ instalado.

**1. Clone e compile**

```bash
git clone https://github.com/your-username/imap-mcp.git
cd imap-mcp
npm install
npm run build
```

**2. Configure o Claude Desktop**

Abra **Configurações → Desenvolvedor → Editar Config** e adicione:

```json
{
  "mcpServers": {
    "imap": {
      "command": "node",
      "args": ["C:\\caminho\\para\\imap-mcp\\dist\\index.js"]
    }
  }
}
```

**3. Reinicie o Claude Desktop e adicione sua conta** (igual aos passos 4–5 acima).

---

## Configurando o Claude Desktop

### Encontrando o arquivo de configuração

Sempre use o botão integrado: **Configurações → Desenvolvedor → Editar Config**.

Se precisar encontrar manualmente:

| Forma de instalação | Localização do arquivo |
|---|---|
| Instalador direto (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Microsoft Store (Windows) | `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json` |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |

> O caminho da Microsoft Store contém um ID de pacote (`Claude_pzs8sxrjxfjjc`) que pode mudar entre versões. Sempre prefira o botão **Editar Config**.

### Formato do arquivo

```json
{
  "mcpServers": {
    "imap": {
      "command": "C:\\imap-mcp\\imap-mcp.exe",
      "args": []
    }
  }
}
```

### Após cada alteração

Você precisa **fechar completamente e reabrir** o Claude Desktop. No Windows, clique com o botão direito no ícone da bandeja do sistema e escolha Sair — fechar a janela não é suficiente.

---

## Adicionando sua primeira conta

Com o servidor rodando, diga ao Claude:

> "Configure minha conta de email"  
> "Adicione meu Gmail"  
> "Configure dante@empresa.com.br"

O Claude chamará `setup_account`. Uma janela de terminal mostrará:

```
╔══════════════════════════════════════════════════════════════════╗
║  Sua senha será digitada DIRETAMENTE no terminal.               ║
║  Ela NÃO passa por este chat nem é vista pelo Claude.           ║
║  NUNCA digite sua senha na janela do chat.                      ║
╚══════════════════════════════════════════════════════════════════╝
Senha para você@exemplo.com: ████████
```

Digite sua senha no terminal. Os caracteres aparecem como `*`. Pressione Enter.

> **Usuários do Gmail e Outlook:** Você precisa de uma **Senha de App**, não sua senha normal. Veja os [Guias por provedor](#guias-por-provedor).

---

## Referência do config.json

O `imap-mcp` salva as configurações de conta no arquivo `config.json`, localizado na mesma pasta do `.exe` (ou na raiz do projeto ao rodar pelo código-fonte).

Você não precisa editar este arquivo manualmente — use `setup_account`, `update_account` e `remove_account` pelo Claude.

### Flags de funcionalidades

Ferramentas de escrita e envio ficam **desabilitadas por padrão** para evitar perda acidental de dados. Habilite explicitamente:

```json
"features": {
  "send_email": true,
  "reply_email": true,
  "delete_email": true,
  "mark_read": true,
  "move_email": true
}
```

### Locale

Defina `"locale": "pt-BR"` para respostas em português.

---

## Ferramentas disponíveis

| Ferramenta | Padrão | Descrição |
|---|---|---|
| `list_accounts` | ✅ | Listar contas configuradas |
| `list_folders` | ✅ | Listar pastas/labels |
| `list_emails` | ✅ | Listar emails recentes com paginação |
| `search_emails` | ✅ | Pesquisar por texto, data, tamanho, flags |
| `get_email` | ✅ | Ler email completo com corpo e anexos |
| `get_attachment` | ✅ | Baixar anexo em base64 |
| `setup_account` | ✅ | Adicionar ou atualizar conta (senha via terminal) |
| `remove_account` | ✅ | Remover conta |
| `update_account` | ✅ | Atualizar host/porta/nome sem alterar senha |
| `list_config` | ✅ | Mostrar configuração atual (sem senhas) |
| `mark_read` | ❌ | Marcar como lido ou não lido |
| `flag_email` | ❌ | Favoritar ou desfavoritar email |
| `move_email` | ❌ | Mover email para outra pasta |
| `delete_email` | ❌ | Excluir email permanentemente |
| `create_folder` | ❌ | Criar nova pasta |
| `delete_folder` | ❌ | Excluir pasta e seu conteúdo |
| `send_email` | ❌ | Enviar novo email |
| `reply_email` | ❌ | Responder email (cabeçalhos configurados automaticamente) |
| `watch_folder` | ❌ | Monitorar novos emails via IMAP IDLE |

✅ = habilitado por padrão · ❌ = habilitar no `config.json`

---

## Guias por provedor

### Gmail

O Gmail exige uma **Senha de App** — sua senha normal não funcionará se você tiver a verificação em duas etapas ativada (o que o Google agora impõe na maioria das contas).

1. Acesse [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Crie uma nova Senha de App (nomeie como "imap-mcp" ou qualquer nome)
3. Copie a senha de 16 caracteres exibida
4. Use estas configurações quando o Claude perguntar:
   - **Host:** `imap.gmail.com`
   - **Porta:** `993`
   - **Seguro:** `true`
   - **Senha:** a senha de 16 caracteres (não a senha da sua conta Google)

> Você também precisa habilitar o IMAP no Gmail: Configurações → Ver todas as configurações → Encaminhamento e POP/IMAP → Ativar IMAP.

### Outlook / Microsoft 365

1. Acesse [account.microsoft.com/security](https://account.microsoft.com/security) → Opções avançadas de segurança → Senhas de aplicativo
2. Crie uma nova Senha de Aplicativo
3. Configurações:
   - **Host:** `outlook.office365.com`
   - **Porta:** `993`
   - **Seguro:** `true`

### Servidor IMAP corporativo (cPanel, SkyMail, etc.)

Peça ao seu provedor de email ou equipe de TI:
- Hostname IMAP (ex: `mail.empresa.com` ou `imap.skymail.net.br`)
- Porta (normalmente `993` com SSL, ou `143` com STARTTLS)
- Se SSL/TLS é obrigatório

---

## Modelo de segurança

- **Senhas nunca são armazenadas no chat.** A ferramenta `setup_account` abre um prompt no terminal. O Claude não consegue ver o que você digita lá.
- **Prioridade de armazenamento de credenciais:**
  1. Keychain do sistema operacional (Windows Credential Manager, macOS Keychain)
  2. Variável de ambiente `IMAP_PASSWORD_VOCE_AT_EXEMPLO_COM`
  3. `config.json` em texto plano — funciona mas exibe um aviso na inicialização
- **Todas as conexões usam TLS.** IMAP sem criptografia não é suportado.
- **Logs vão apenas para stderr.** O MCP usa stdout para JSON-RPC; logs nunca corrompem o protocolo.
- **Sem telemetria.** Zero chamadas externas além do seu próprio servidor de email.

---

## Compilando do código-fonte

```bash
git clone https://github.com/your-username/imap-mcp.git
cd imap-mcp
npm install
npm run build        # compila para dist/
npm run package      # gera imap-mcp.exe (Windows)
```

Requisitos: Node.js 20+, npm 10+.

---

## Solução de problemas

**O servidor não aparece no Claude Desktop**
- Certifique-se de ter fechado completamente o Claude Desktop (ícone da bandeja → Sair) e reaberto
- Verifique o caminho no `claude_desktop_config.json` — use barras duplas no Windows: `C:\\imap-mcp\\imap-mcp.exe`
- Abra **Configurações → Desenvolvedor** e veja se o servidor exibe algum erro

**Mensagem "Nenhuma conta configurada"**
- O servidor iniciou com sucesso. Diga ao Claude "configure minha conta de email" para adicionar a primeira conta.

**O prompt de senha não aparece**
- A janela do terminal pode estar atrás de outras janelas. Verifique a barra de tarefas.

**Gmail: falha de autenticação**
- Use uma Senha de App, não sua senha normal do Gmail.
- O IMAP precisa estar habilitado nas configurações do Gmail.

**Conexão recusada / timeout**
- Verifique o host e a porta IMAP com seu provedor de email.
- Verifique se um firewall está bloqueando a porta 993 de saída.
