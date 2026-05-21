import type { MessageKey } from "./en.js";

export const ptBR: Record<MessageKey, string> = {
  "startup.config_not_found":
    "Arquivo de configuração não encontrado. Execute 'npx imap-mcp setup' para começar.",
  "startup.config_invalid": "Configuração inválida: {{details}}",
  "startup.deprecated_password":
    "Aviso: a conta '{{name}}' possui senha em texto puro no config.json. " +
    "Execute 'npx imap-mcp setup' para migrar para armazenamento seguro.",
  "startup.ready": "Servidor imap-mcp pronto",

  "account.not_found": "Conta não encontrada: {{email}}",
  "account.no_credentials":
    "Nenhuma credencial encontrada para {{email}}. Execute 'npx imap-mcp setup' para configurar.",

  "tool.list_accounts.description": "Listar todas as contas de email configuradas",
  "tool.list_accounts.no_accounts": "Nenhuma conta configurada.",

  "tool.list_folders.description": "Listar todas as pastas/labels de uma conta de email",
  "tool.list_folders.param_email": "Endereço de email da conta",

  "tool.list_emails.description": "Listar emails recentes de uma pasta. Use pageToken para paginação.",
  "tool.list_emails.param_email": "Endereço de email da conta",
  "tool.list_emails.param_folder": "Nome da pasta (padrão: INBOX)",
  "tool.list_emails.param_limit": "Número máximo de emails a retornar (padrão: 20)",
  "tool.list_emails.param_page_token": "Token de paginação de uma resposta anterior",
  "tool.list_emails.empty": "Nenhum email encontrado em {{folder}}.",
  "tool.list_emails.param_page_token_out": "Token para passar como pageToken para obter a próxima página",

  "tool.search_emails.description": "Pesquisar emails por remetente, assunto ou conteúdo",
  "tool.search_emails.param_email": "Endereço de email da conta",
  "tool.search_emails.param_query": "Texto de pesquisa (busca em remetente, assunto ou corpo)",
  "tool.search_emails.param_folder": "Pasta para pesquisar (padrão: INBOX)",
  "tool.search_emails.param_unread_only": "Retornar apenas emails não lidos",
  "tool.search_emails.no_results": "Nenhum email encontrado para '{{query}}'.",

  "tool.get_email.description": "Obter o conteúdo completo de um email pelo seu UID",
  "tool.get_email.param_email": "Endereço de email da conta",
  "tool.get_email.param_uid": "Identificador único do email",
  "tool.get_email.param_folder": "Pasta que contém o email (padrão: INBOX)",
  "tool.get_email.empty_body": "(corpo vazio)",

  "tool.get_attachment.description": "Baixar um anexo de um email pelo seu índice",
  "tool.get_attachment.param_email": "Endereço de email da conta",
  "tool.get_attachment.param_uid": "Identificador único do email",
  "tool.get_attachment.param_folder": "Pasta que contém o email (padrão: INBOX)",
  "tool.get_attachment.param_index": "Índice (base zero) do anexo (0 = primeiro)",

  "tool.reply_email.description": "Responder um email, configurando automaticamente In-Reply-To e References",
  "tool.reply_email.param_email": "Endereço de email da conta remetente",
  "tool.reply_email.param_uid": "UID do email a ser respondido",
  "tool.reply_email.param_folder": "Pasta que contém o email original (padrão: INBOX)",
  "tool.reply_email.param_text": "Corpo da resposta em texto simples",
  "tool.reply_email.param_html": "Corpo da resposta em HTML (opcional)",
  "tool.reply_email.param_cc": "Destinatários CC (opcional)",
  "tool.reply_email.param_bcc": "Destinatários BCC (opcional)",
  "tool.reply_email.param_reply_all": "Responder a todos os destinatários originais (padrão: false)",
  "tool.reply_email.success": "Resposta enviada. Message-ID: {{messageId}}",

  "tool.flag_email.description": "Favoritar ou desfavoritar um email (\\Flagged)",
  "tool.flag_email.param_email": "Endereço de email da conta",
  "tool.flag_email.param_uid": "Identificador único do email",
  "tool.flag_email.param_folder": "Pasta que contém o email (padrão: INBOX)",
  "tool.flag_email.param_flagged": "True para favoritar, false para desfavoritar",
  "tool.flag_email.success": "Email {{uid}} {{status}}.",

  "tool.create_folder.description": "Criar uma nova pasta/caixa de correio",
  "tool.create_folder.param_email": "Endereço de email da conta",
  "tool.create_folder.param_path": "Caminho completo da pasta (ex: 'Arquivo/2024')",
  "tool.create_folder.success": "Pasta '{{path}}' criada.",

  "tool.delete_folder.description": "Excluir uma pasta/caixa de correio e todo o seu conteúdo",
  "tool.delete_folder.param_email": "Endereço de email da conta",
  "tool.delete_folder.param_path": "Caminho completo da pasta a excluir",
  "tool.delete_folder.success": "Pasta '{{path}}' excluída.",

  "tool.watch_folder.description": "Observar uma pasta por novos emails usando IMAP IDLE",
  "tool.watch_folder.param_email": "Endereço de email da conta",
  "tool.watch_folder.param_folder": "Pasta a observar (padrão: INBOX)",
  "tool.watch_folder.started": "Observando '{{folder}}' por novos emails. Watch ID: {{watchId}}",
  "tool.watch_folder.stopped": "Parou de observar '{{folder}}'.",

  "tool.unwatch_folder.description": "Parar de observar uma pasta (cancelar um watch iniciado com watch_folder)",
  "tool.unwatch_folder.param_watch_id": "Watch ID retornado pelo watch_folder",
  "tool.unwatch_folder.not_found": "Watch ID '{{watchId}}' não encontrado.",

  "tool.search_emails.param_since": "Retornar emails recebidos após esta data (ISO 8601, ex: '2024-01-01')",
  "tool.search_emails.param_before": "Retornar emails recebidos antes desta data (ISO 8601)",
  "tool.search_emails.param_larger_than": "Retornar emails maiores que este tamanho em bytes",
  "tool.search_emails.param_smaller_than": "Retornar emails menores que este tamanho em bytes",
  "tool.search_emails.param_has_attachment": "Retornar apenas emails com anexos",
  "tool.search_emails.param_flagged": "Retornar apenas emails favoritados",
  "tool.search_emails.param_limit": "Número máximo de resultados (padrão: 30)",

  "tool.mark_read.description": "Marcar um email como lido ou não lido",
  "tool.mark_read.param_email": "Endereço de email da conta",
  "tool.mark_read.param_uid": "Identificador único do email",
  "tool.mark_read.param_folder": "Pasta que contém o email (padrão: INBOX)",
  "tool.mark_read.param_read": "True para marcar como lido, false para não lido",
  "tool.mark_read.success": "Email {{uid}} marcado como {{status}}.",

  "tool.move_email.description": "Mover um email para outra pasta",
  "tool.move_email.param_email": "Endereço de email da conta",
  "tool.move_email.param_uid": "Identificador único do email",
  "tool.move_email.param_folder": "Pasta de origem do email (padrão: INBOX)",
  "tool.move_email.param_destination": "Caminho da pasta de destino",
  "tool.move_email.success": "Email {{uid}} movido para {{destination}}.",

  "tool.delete_email.description": "Excluir permanentemente um email",
  "tool.delete_email.param_email": "Endereço de email da conta",
  "tool.delete_email.param_uid": "Identificador único do email",
  "tool.delete_email.param_folder": "Pasta que contém o email (padrão: INBOX)",
  "tool.delete_email.success": "Email {{uid}} excluído.",

  "tool.send_email.description": "Enviar um email a partir de uma conta configurada",
  "tool.send_email.param_email": "Endereço de email da conta remetente",
  "tool.send_email.param_to": "Destinatário(s), separados por vírgula ou array",
  "tool.send_email.param_subject": "Assunto do email",
  "tool.send_email.param_text": "Corpo em texto simples",
  "tool.send_email.param_html": "Corpo HTML (opcional, usado no lugar do texto se fornecido)",
  "tool.send_email.param_cc": "Destinatários CC (opcional)",
  "tool.send_email.param_bcc": "Destinatários BCC (opcional)",
  "tool.send_email.param_reply_to": "Endereço de resposta (opcional)",
  "tool.send_email.param_in_reply_to": "Message-ID do email sendo respondido (opcional)",
  "tool.send_email.success": "Email enviado. Message-ID: {{messageId}}",

  "error.connection_failed": "Falha ao conectar ao servidor IMAP: {{details}}",
  "error.operation_timeout": "Operação expirou após {{ms}}ms",
  "error.folder_not_found": "Pasta não encontrada: {{folder}}",
  "error.email_not_found": "Email não encontrado: UID {{uid}}",
  "error.unexpected": "Erro inesperado: {{details}}",
};
