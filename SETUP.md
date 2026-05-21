# imap-mcp — Configuração

## 1. Instalar dependências

Abra o terminal na pasta do projeto e rode:

```bash
npm install
```

## 2. Preencher as senhas

Abra o arquivo `config.json` e substitua `SENHA_AQUI` pela senha real de cada conta.

---

## Opção A — Rodar direto com Node.js

```bash
npm run build
```

Configure o Claude (veja passo 4) com:
```json
"command": "node",
"args": ["C:\\VSCode\\imap-mcp\\dist\\index.js"]
```

---

## Opção B — Gerar um .exe standalone

```bash
npm run package
```

Isso vai gerar o arquivo `imap-mcp.exe` na raiz do projeto.
O `.exe` já inclui o runtime do Node.js — não precisa ter Node instalado para rodar.

> **Importante:** o `config.json` deve ficar na **mesma pasta** que o `imap-mcp.exe`.

Configure o Claude (veja passo 4) com:
```json
"command": "C:\\VSCode\\imap-mcp\\imap-mcp.exe",
"args": []
```

---

## 3. Conectar ao Cowork (Claude)

Abra o arquivo de configuração do Claude:

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Adicione o bloco abaixo (escolha Opção A ou B acima):

```json
{
  "mcpServers": {
    "imap": {
      "command": "C:\\VSCode\\imap-mcp\\imap-mcp.exe",
      "args": []
    }
  }
}
```

Se o arquivo não existir, crie-o com esse conteúdo completo.

## 4. Reiniciar o Cowork

Feche e abra o Cowork. O conector IMAP estará disponível automaticamente.

---

## Ferramentas disponíveis

| Ferramenta      | O que faz                                      |
|-----------------|------------------------------------------------|
| `list_accounts` | Lista todas as contas configuradas             |
| `list_folders`  | Lista as pastas de uma conta                   |
| `list_emails`   | Lista e-mails recentes de uma pasta            |
| `search_emails` | Busca por remetente, assunto ou conteúdo       |
| `get_email`     | Lê o conteúdo completo de um e-mail pelo UID  |
