CREATE TABLE igrejas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cidade TEXT,
    endereco TEXT,
    whatsapp TEXT,
    horario_culto TEXT,
    ativo INTEGER DEFAULT 1
, tipo TEXT DEFAULT 'igreja', latitud REAL, longitud REAL, `numero_oficial` varchar(255) null);
CREATE TABLE sqlite_sequence(name,seq);
CREATE TABLE pastores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    telefone TEXT,
    email TEXT,
    igreja_id INTEGER REFERENCES igrejas(id),
    cargo TEXT,
    estado_civil TEXT,
    conjuge_nome TEXT,
    ativo INTEGER DEFAULT 1
);
CREATE TABLE pessoas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telefone TEXT NOT NULL UNIQUE,
    nome TEXT,
    igreja_id INTEGER REFERENCES igrejas(id),
    origem TEXT,
    qr_codigo TEXT,
    consentimento INTEGER DEFAULT 0,
    data_consentimento TEXT,
    data_primeiro_contato TEXT NOT NULL,
    data_ultimo_contato TEXT,
    ativo INTEGER DEFAULT 1
, consentimento_automatico INTEGER DEFAULT 0, tipo_consentimento TEXT DEFAULT 'manual', bienvenida_enviada INTEGER DEFAULT 0, ultima_resposta_em TEXT);
CREATE TABLE mensagens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pessoa_id INTEGER REFERENCES pessoas(id),
    remetente TEXT NOT NULL,
    texto TEXT NOT NULL,
    classificacao TEXT,
    sentimento TEXT,
    respondida INTEGER DEFAULT 0,
    resposta_texto TEXT,
    resposta_agente TEXT,
    data_envio TEXT NOT NULL,
    data_resposta TEXT,
    tempo_resposta_seg INTEGER
, prioridade TEXT DEFAULT 'normal', severidade TEXT, revisado_por TEXT);
CREATE TABLE comunicados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    texto TEXT NOT NULL,
    tipo TEXT NOT NULL,
    igreja_id INTEGER REFERENCES igrejas(id),
    data_envio TEXT NOT NULL,
    data_agendado TEXT,
    enviado INTEGER DEFAULT 0,
    total_destinos INTEGER,
    total_entregues INTEGER,
    criado_por TEXT
, `nivel` varchar(255) null, `filtro_id` integer null, `template_id` integer null, `status` varchar(255) null default 'rascunho');
CREATE TABLE metricas_diarias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    igreja_id INTEGER REFERENCES igrejas(id),
    data TEXT NOT NULL,
    total_mensagens INTEGER DEFAULT 0,
    total_pessoas_novas INTEGER DEFAULT 0,
    total_pedidos_oracao INTEGER DEFAULT 0,
    total_testemunhos INTEGER DEFAULT 0,
    total_consentimentos INTEGER DEFAULT 0,
    tempo_medio_resposta_seg INTEGER,
    UNIQUE(igreja_id, data)
);
CREATE TABLE qrcodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    igreja_id INTEGER REFERENCES igrejas(id),
    codigo TEXT NOT NULL UNIQUE,
    dia_semana TEXT NOT NULL,
    ativo INTEGER DEFAULT 1,
    data_criacao TEXT NOT NULL,
    UNIQUE(igreja_id, dia_semana)
);
CREATE TABLE auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_inicio TEXT NOT NULL,
    data_fim TEXT NOT NULL,
    nota_saude INTEGER,
    total_atendimentos INTEGER,
    total_igrejas_ativas INTEGER,
    resolucao_automatica_pct REAL,
    tempo_medio_resposta_seg INTEGER,
    recomendacoes TEXT,
    gerado_por TEXT,
    data_geracao TEXT NOT NULL
);
CREATE TABLE agendamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pessoa_id INTEGER,
  pessoa_telefone TEXT,
  igreja_id INTEGER,
  pastor_id INTEGER,
  data_solicitacao TEXT,
  data_agendada TEXT,
  hora_agendada TEXT,
  status TEXT DEFAULT 'pendente',
  motivo TEXT,
  criado_em TEXT DEFAULT (datetime('now', '-4 hours')),
  FOREIGN KEY (pessoa_id) REFERENCES pessoas(id),
  FOREIGN KEY (igreja_id) REFERENCES igrejas(id)
);
CREATE TABLE qrcodes_arquivos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    igreja_id INTEGER NOT NULL REFERENCES igrejas(id),
    caminho_arquivo TEXT NOT NULL,
    url_destino TEXT NOT NULL,
    criado_em TEXT DEFAULT (datetime('now', '-4 hours')),
    UNIQUE(igreja_id)
);
CREATE TABLE respostas_ia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mensagem_id INTEGER,
  remetente TEXT,
  pergunta TEXT,
  resposta_gerada TEXT,
  resposta_final TEXT,
  status TEXT DEFAULT 'rascunho',
  agente TEXT,
  revisado_por TEXT,
  created_at TEXT DEFAULT (datetime('now', '-4 hours')),
  updated_at TEXT
, classificacao TEXT DEFAULT 'oracao');
CREATE TABLE sessions (
    remetente TEXT PRIMARY KEY,
    contexto TEXT,
    updated_at TEXT DEFAULT (datetime('now', '-4 hours'))
);
CREATE TABLE templates_mensagem (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  titulo TEXT,
  texto TEXT NOT NULL,
  tipo TEXT DEFAULT 'personalizado',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE agendamentos_mensagem (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER REFERENCES templates_mensagem(id),
  canal TEXT NOT NULL,
  escopo TEXT NOT NULL,
  igreja_id INTEGER,
  data_agendado DATETIME NOT NULL,
  enviado INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE historico_mensagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mensagem_original TEXT,
  canal TEXT NOT NULL,
  escopo TEXT,
  igreja_id INTEGER,
  pessoa_id INTEGER,
  status TEXT DEFAULT 'enviada',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE templates (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nome        TEXT NOT NULL,
    titulo      TEXT,
    texto       TEXT NOT NULL,
    tipo        TEXT,
    created_at  TEXT DEFAULT (datetime('now', '-4 hours'))
);
CREATE TABLE historico_broadcast (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id     INTEGER NOT NULL,
    canal           TEXT DEFAULT 'whatsapp',
    escopo          TEXT DEFAULT 'pais',
    igreja_id       INTEGER,
    total_destinos  INTEGER DEFAULT 0,
    total_enviados  INTEGER DEFAULT 0,
    data_envio      TEXT,
    created_at      TEXT DEFAULT (datetime('now', '-4 hours')), `comunicado_id` integer null, `destinatario` varchar(255) null, `status` varchar(255) null, `nivel` varchar(255) null,
    FOREIGN KEY (template_id) REFERENCES templates(id),
    FOREIGN KEY (igreja_id) REFERENCES igrejas(id)
);
CREATE TABLE auditoria_consentimento (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    pessoa_id       INTEGER,
    telefone_hash   TEXT NOT NULL,
    acao            TEXT NOT NULL,
    tipo            TEXT DEFAULT 'whatsapp',
    ip              TEXT,
    data            TEXT DEFAULT (datetime('now', '-4 hours')),
    FOREIGN KEY (pessoa_id) REFERENCES pessoas(id)
);
CREATE TABLE programacao (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo        TEXT NOT NULL CHECK(tipo IN ('tv', 'radio')),
    dia_semana  INTEGER NOT NULL CHECK(dia_semana BETWEEN 0 AND 6),
    horario     TEXT NOT NULL,
    titulo      TEXT NOT NULL,
    descricao   TEXT,
    ativo       INTEGER DEFAULT 1
);
CREATE TABLE numeros_autorizados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telefone TEXT NOT NULL UNIQUE,
    tipo TEXT NOT NULL DEFAULT 'igreja',  -- igreja, cadena, central, pastor
    entidade_id INTEGER,  -- igreja_id ou cadena_id
    entidade_nome TEXT,
    descricao TEXT,
    ativo INTEGER DEFAULT 1,
    criado_em TEXT DEFAULT (datetime('now', '-4 hours')),
    criado_por TEXT,
    UNIQUE(telefone, tipo, entidade_id)
);
CREATE TABLE instancias_waha (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'igreja',  -- igreja, cadena, central
    entidade_id INTEGER,
    porta INTEGER,
    api_key TEXT,
    ativo INTEGER DEFAULT 1,
    ultimo_status TEXT,
    criado_em TEXT DEFAULT (datetime('now', '-4 hours'))
);
CREATE TABLE cadeias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    igreja_id INTEGER REFERENCES igrejas(id),
    numero_whatsapp TEXT,
    coordenador_id INTEGER,
    corrente_id INTEGER,
    ativo INTEGER DEFAULT 1,
    criado_em TEXT DEFAULT (datetime('now', '-4 hours'))
);
CREATE TABLE membros_cadeia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cadeia_id INTEGER NOT NULL REFERENCES cadeias(id),
    pessoa_id INTEGER NOT NULL REFERENCES pessoas(id),
    data_entrada TEXT DEFAULT (datetime('now', '-4 hours')),
    ativo INTEGER DEFAULT 1,
    UNIQUE(cadeia_id, pessoa_id)
);
CREATE TABLE consentimento_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pessoa_id INTEGER REFERENCES pessoas(id),
    telefone TEXT,
    acao TEXT NOT NULL,  -- concedido, revogado, perguntado, expirado
    metodo TEXT,  -- automatico, manual, webhook
    detalhes TEXT,
    data TEXT DEFAULT (datetime('now', '-4 hours'))
);
CREATE TABLE log_envio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comunicado_id INTEGER REFERENCES comunicados(id),
    pessoa_id INTEGER REFERENCES pessoas(id),
    telefone TEXT,
    numero_origem TEXT,
    status TEXT DEFAULT 'pendente',  -- pendente, enviado, falhou, lido
    data_envio TEXT DEFAULT (datetime('now', '-4 hours')),
    erro TEXT
);
CREATE TABLE pastores_login (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pastor_id INTEGER NOT NULL REFERENCES pastores(id),
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    ultimo_acesso TEXT,
    token TEXT,
    token_expiracao TEXT,
    ativo INTEGER DEFAULT 1,
    criado_em TEXT DEFAULT (datetime('now', '-4 hours'))
);
CREATE TABLE mensagens_waha (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contato_id TEXT NOT NULL,
            mensagem TEXT,
            direcao TEXT NOT NULL CHECK(direcao IN ('recebida', 'enviada')),
            created_at TEXT NOT NULL,
            chat_name TEXT,
            mensagem_id TEXT UNIQUE
        );
CREATE TABLE `directus_migrations` (`version` varchar(255) not null, `name` varchar(255) not null, `timestamp` datetime default CURRENT_TIMESTAMP, primary key (`version`));
CREATE TABLE IF NOT EXISTS "directus_folders" (`id` char(36) NOT NULL, `name` varchar(255) NOT NULL, `parent` char(36), PRIMARY KEY (`id`), FOREIGN KEY (`parent`) REFERENCES `directus_folders` (`id`));
CREATE TABLE IF NOT EXISTS "directus_relations" (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `many_collection` varchar(64) NOT NULL, `many_field` varchar(64) NOT NULL, `one_collection` varchar(64), `one_field` varchar(64), `one_collection_field` varchar(64), `one_allowed_collections` text, `junction_field` varchar(64), `sort_field` varchar(64), `one_deselect_action` varchar(255) NOT NULL DEFAULT 'nullify');
CREATE TABLE IF NOT EXISTS "directus_files" (`id` char(36) NOT NULL, `storage` varchar(255) NOT NULL, `filename_disk` varchar(255), `filename_download` varchar(255) NOT NULL, `title` varchar(255), `type` varchar(255), `folder` char(36), `uploaded_by` char(36), "created_on" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, `modified_by` char(36), `modified_on` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, `charset` varchar(50), `filesize` bigint DEFAULT null, `width` integer, `height` integer, `duration` integer, `embed` varchar(200), `description` text, `location` text, `tags` text, `metadata` json, `focal_point_x` integer null, `focal_point_y` integer null, `tus_id` varchar(64) null, `tus_data` json null, `uploaded_on` datetime, PRIMARY KEY (`id`), FOREIGN KEY (`uploaded_by`) REFERENCES `directus_users` (`id`), FOREIGN KEY (`modified_by`) REFERENCES `directus_users` (`id`), FOREIGN KEY (`folder`) REFERENCES `directus_folders` (`id`) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS "directus_fields" (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `collection` varchar(64) NOT NULL, `field` varchar(64) NOT NULL, `special` varchar(64), `interface` varchar(64), `options` json, `display` varchar(64), `display_options` json, `readonly` boolean NOT NULL DEFAULT '0', `hidden` boolean NOT NULL DEFAULT '0', `sort` integer, `width` varchar(30) DEFAULT 'full', `translations` json, `note` text, `conditions` json, `required` boolean DEFAULT '0', `group` varchar(64), `validation` json, `validation_message` text, `searchable` boolean not null default '1');
CREATE TABLE `directus_operations` (`id` char(36) not null, `name` varchar(255), `key` varchar(255) not null, `type` varchar(255) not null, `position_x` integer not null, `position_y` integer not null, `options` json, `resolve` char(36), `reject` char(36), `flow` char(36) not null, `date_created` datetime default CURRENT_TIMESTAMP, `user_created` char(36), foreign key(`resolve`) references `directus_operations`(`id`), foreign key(`reject`) references `directus_operations`(`id`), foreign key(`flow`) references `directus_flows`(`id`) on delete CASCADE, foreign key(`user_created`) references `directus_users`(`id`) on delete SET NULL, primary key (`id`));
CREATE TABLE IF NOT EXISTS "directus_notifications" (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `timestamp` datetime DEFAULT CURRENT_TIMESTAMP, `status` varchar(255) DEFAULT 'inbox', `recipient` char(36) NOT NULL, `sender` char(36), `subject` varchar(255) NOT NULL, `message` text, `collection` varchar(64), `item` varchar(255), FOREIGN KEY (`recipient`) REFERENCES `directus_users` (`id`) ON DELETE CASCADE, FOREIGN KEY (`sender`) REFERENCES `directus_users` (`id`));
CREATE TABLE `directus_translations` (`id` char(36) not null, `language` varchar(255) not null, `key` varchar(255) not null, `value` text not null, primary key (`id`));
CREATE TABLE IF NOT EXISTS "directus_shares" (`id` char(36) NOT NULL, `name` varchar(255), `collection` varchar(64) NOT NULL, `item` varchar(255) NOT NULL, `role` char(36), `password` varchar(255), `user_created` char(36), `date_created` datetime DEFAULT CURRENT_TIMESTAMP, `date_start` datetime NULL DEFAULT null, `date_end` datetime NULL DEFAULT null, `times_used` integer DEFAULT '0', `max_uses` integer, FOREIGN KEY (`collection`) REFERENCES `directus_collections` (`collection`) ON DELETE CASCADE, FOREIGN KEY (`role`) REFERENCES `directus_roles` (`id`) ON DELETE CASCADE, FOREIGN KEY (`user_created`) REFERENCES `directus_users` (`id`) ON DELETE SET NULL, PRIMARY KEY (`id`));
CREATE TABLE `directus_versions` (`id` char(36) not null, `key` varchar(64) not null, `name` varchar(255), `collection` varchar(64) not null, `item` varchar(255) not null, `hash` varchar(255), `date_created` datetime default CURRENT_TIMESTAMP, `date_updated` datetime default CURRENT_TIMESTAMP, `user_created` char(36), `user_updated` char(36), `delta` json, foreign key(`collection`) references `directus_collections`(`collection`) on delete CASCADE, foreign key(`user_created`) references `directus_users`(`id`) on delete SET NULL, foreign key(`user_updated`) references `directus_users`(`id`), primary key (`id`));
CREATE TABLE IF NOT EXISTS "directus_revisions" (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `activity` integer NOT NULL, `collection` varchar(64) NOT NULL, `item` varchar(255) NOT NULL, `data` json, `delta` json, `parent` integer, `version` char(36), FOREIGN KEY (`parent`) REFERENCES `directus_revisions` (`id`), FOREIGN KEY (`activity`) REFERENCES `directus_activity` (`id`) ON DELETE CASCADE, FOREIGN KEY (`version`) REFERENCES `directus_versions` (`id`) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS "directus_users" (`id` char(36) NOT NULL, `first_name` varchar(50), `last_name` varchar(50), `email` varchar(128), `password` varchar(255), `location` varchar(255), `title` varchar(50), `description` text, `tags` json, `avatar` char(36), `language` varchar(255) DEFAULT null, `tfa_secret` varchar(255), `status` varchar(16) NOT NULL DEFAULT 'active', `role` char(36), `token` varchar(255), `last_access` datetime, `last_page` varchar(255), `provider` varchar(128) NOT NULL DEFAULT 'default', `external_identifier` varchar(255), `auth_data` json, `email_notifications` boolean DEFAULT '1', `appearance` varchar(255), `theme_dark` varchar(255), `theme_light` varchar(255), `theme_light_overrides` json, `theme_dark_overrides` json, `text_direction` varchar(255) not null default 'auto', PRIMARY KEY (`id`), FOREIGN KEY (`role`) REFERENCES `directus_roles` (`id`) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS "directus_extensions" (`enabled` boolean NOT NULL DEFAULT '1', `id` char(36) NOT NULL, `folder` varchar(255) NOT NULL, `source` varchar(255) NOT NULL, `bundle` char(36), PRIMARY KEY (`id`));
CREATE TABLE IF NOT EXISTS "directus_sessions" (`token` varchar(64) NOT NULL, `user` char(36), `expires` datetime NOT NULL, `ip` varchar(255), `user_agent` text, `share` char(36), `origin` varchar(255) NULL, `next_token` varchar(64) null, PRIMARY KEY (`token`), FOREIGN KEY (`user`) REFERENCES `directus_users` (`id`) ON DELETE CASCADE, FOREIGN KEY (`share`) REFERENCES `directus_shares` (`id`) ON DELETE CASCADE);
CREATE TABLE `directus_policies` (`id` char(36), `name` varchar(100) not null, `icon` varchar(64) not null default 'badge', `description` text, `ip_access` text, `enforce_tfa` boolean not null default '0', `admin_access` boolean not null default '0', `app_access` boolean not null default '0', primary key (`id`));
CREATE TABLE IF NOT EXISTS "directus_permissions" (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `collection` varchar(64) NOT NULL, `action` varchar(10) NOT NULL, `permissions` json, `validation` json, `presets` json, `fields` text, `policy` char(36) NOT NULL, FOREIGN KEY (`policy`) REFERENCES `directus_policies` (`id`) ON DELETE CASCADE);
CREATE TABLE `directus_access` (`id` char(36), `role` char(36) null, `user` char(36) null, `policy` char(36) not null, `sort` integer, foreign key(`role`) references `directus_roles`(`id`) on delete CASCADE, foreign key(`user`) references `directus_users`(`id`) on delete CASCADE, foreign key(`policy`) references `directus_policies`(`id`) on delete CASCADE, primary key (`id`));
CREATE TABLE IF NOT EXISTS "directus_collections" (`collection` varchar(64) NOT NULL, `icon` varchar(64), `note` text, `display_template` varchar(255), `hidden` boolean NOT NULL DEFAULT '0', `singleton` boolean NOT NULL DEFAULT '0', `translations` json, `archive_field` varchar(64), `archive_app_filter` boolean NOT NULL DEFAULT '1', `archive_value` varchar(255), `unarchive_value` varchar(255), `sort_field` varchar(64), `accountability` varchar(255) DEFAULT 'all', `color` varchar(255) NULL, `item_duplication_fields` json NULL, `sort` integer, `group` varchar(64), `collapse` varchar(255) NOT NULL DEFAULT 'open', `preview_url` varchar(255) NULL, `versioning` boolean NOT NULL DEFAULT '0', PRIMARY KEY (`collection`), FOREIGN KEY (`group`) REFERENCES `directus_collections` (`collection`));
CREATE TABLE IF NOT EXISTS "directus_dashboards" (`id` char(36) NOT NULL, `name` varchar(255) NOT NULL, `icon` varchar(64) NOT NULL DEFAULT 'dashboard', `note` text, `date_created` datetime DEFAULT CURRENT_TIMESTAMP, `user_created` char(36), `color` varchar(255) NULL, FOREIGN KEY (`user_created`) REFERENCES `directus_users` (`id`) ON DELETE SET NULL, PRIMARY KEY (`id`));
CREATE TABLE IF NOT EXISTS "directus_flows" (`id` char(36) NOT NULL, `name` varchar(255) NOT NULL, `icon` varchar(64), `color` varchar(255) NULL, `description` text, `status` varchar(255) NOT NULL DEFAULT 'active', `trigger` varchar(255), `accountability` varchar(255) DEFAULT 'all', `options` json, `operation` char(36), `date_created` datetime DEFAULT CURRENT_TIMESTAMP, `user_created` char(36), FOREIGN KEY (`user_created`) REFERENCES `directus_users` (`id`) ON DELETE SET NULL, PRIMARY KEY (`id`));
CREATE TABLE IF NOT EXISTS "directus_panels" (`id` char(36) NOT NULL, `dashboard` char(36) NOT NULL, `name` varchar(255), `icon` varchar(64) DEFAULT null, `color` varchar(10), `show_header` boolean NOT NULL DEFAULT '0', `note` text, `type` varchar(255) NOT NULL, `position_x` integer NOT NULL, `position_y` integer NOT NULL, `width` integer NOT NULL, `height` integer NOT NULL, `options` json, `date_created` datetime DEFAULT CURRENT_TIMESTAMP, `user_created` char(36), FOREIGN KEY (`dashboard`) REFERENCES `directus_dashboards` (`id`) ON DELETE CASCADE, FOREIGN KEY (`user_created`) REFERENCES `directus_users` (`id`) ON DELETE SET NULL, PRIMARY KEY (`id`));
CREATE TABLE IF NOT EXISTS "directus_presets" (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `bookmark` varchar(255), `user` char(36), `role` char(36), `collection` varchar(64), `search` varchar(100), `layout` varchar(100) DEFAULT 'tabular', `layout_query` json, `layout_options` json, `refresh_interval` integer, `filter` json, `icon` varchar(64) DEFAULT 'bookmark', `color` varchar(255) NULL, FOREIGN KEY (`user`) REFERENCES `directus_users` (`id`) ON DELETE CASCADE, FOREIGN KEY (`role`) REFERENCES `directus_roles` (`id`) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS "directus_roles" (`id` char(36) NOT NULL, `name` varchar(100) NOT NULL, `icon` varchar(64) NOT NULL DEFAULT 'supervised_user_circle', `description` text, `parent` char(36), PRIMARY KEY (`id`), FOREIGN KEY (`parent`) REFERENCES `directus_roles` (`id`));
CREATE TABLE IF NOT EXISTS "directus_comments" (`id` char(36) NOT NULL, `collection` varchar(64) NOT NULL, `item` varchar(255) NOT NULL, `comment` text NOT NULL, `date_created` datetime DEFAULT CURRENT_TIMESTAMP, `date_updated` datetime DEFAULT CURRENT_TIMESTAMP, `user_created` char(36), `user_updated` char(36), FOREIGN KEY (`user_created`) REFERENCES `directus_users` (`id`) ON DELETE SET NULL, FOREIGN KEY (`user_updated`) REFERENCES `directus_users` (`id`), PRIMARY KEY (`id`));
CREATE TABLE IF NOT EXISTS "directus_activity" (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `action` varchar(45) NOT NULL, `user` char(36), `timestamp` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, `ip` varchar(50), `user_agent` text, `collection` varchar(64) NOT NULL, `item` varchar(255) NOT NULL, `origin` varchar(255) NULL);
CREATE TABLE IF NOT EXISTS "directus_settings" (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `project_name` varchar(100) NOT NULL DEFAULT 'Directus', `project_url` varchar(255), `project_color` varchar(255) NOT NULL DEFAULT '#6644FF', `project_logo` char(36), `public_foreground` char(36), `public_background` char(36), `public_note` text, `auth_login_attempts` integer DEFAULT '25', `auth_password_policy` varchar(100), `storage_asset_transform` varchar(7) DEFAULT 'all', `storage_asset_presets` json, `custom_css` text, `storage_default_folder` char(36), `basemaps` json, `mapbox_key` varchar(255), `module_bar` json, `project_descriptor` varchar(100) NULL, `default_language` varchar(255) NOT NULL DEFAULT 'en-US', `custom_aspect_ratios` json, `public_favicon` char(36), `default_appearance` varchar(255) NOT NULL DEFAULT 'auto', `default_theme_light` varchar(255), `theme_light_overrides` json, `default_theme_dark` varchar(255), `theme_dark_overrides` json, `report_error_url` varchar(255) NULL, `report_bug_url` varchar(255) NULL, `report_feature_url` varchar(255) NULL, `public_registration` boolean NOT NULL DEFAULT '0', `public_registration_verify_email` boolean NOT NULL DEFAULT '1', `public_registration_role` char(36) NULL, `public_registration_email_filter` json NULL, `visual_editor_urls` json NULL, `project_id` char(36), `mcp_enabled` boolean NOT NULL DEFAULT '0', `mcp_allow_deletes` boolean NOT NULL DEFAULT '0', `mcp_prompts_collection` varchar(255) NULL DEFAULT null, `mcp_system_prompt_enabled` boolean NOT NULL DEFAULT '1', `mcp_system_prompt` text NULL DEFAULT null, `project_owner` varchar(255), `project_usage` varchar(255), `org_name` varchar(255), `product_updates` boolean, `project_status` varchar(255), `ai_openai_api_key` text, `ai_anthropic_api_key` text, `ai_system_prompt` text, `ai_google_api_key` text, `ai_openai_compatible_api_key` text, `ai_openai_compatible_base_url` text, `ai_openai_compatible_name` text, `ai_openai_compatible_models` json, `ai_openai_compatible_headers` json, `ai_openai_allowed_models` json, `ai_anthropic_allowed_models` json, `ai_google_allowed_models` json, `collaborative_editing_enabled` boolean not null default '0', FOREIGN KEY (`project_logo`) REFERENCES `directus_files` (`id`), FOREIGN KEY (`public_foreground`) REFERENCES `directus_files` (`id`), FOREIGN KEY (`public_background`) REFERENCES `directus_files` (`id`), CONSTRAINT `directus_settings_storage_default_folder_foreign` FOREIGN KEY (`storage_default_folder`) REFERENCES `directus_folders` (`id`) ON DELETE SET NULL, FOREIGN KEY (`public_favicon`) REFERENCES `directus_files` (`id`), FOREIGN KEY (`public_registration_role`) REFERENCES `directus_roles` (`id`) ON DELETE SET NULL);
CREATE TABLE `directus_deployments` (`id` char(36) not null, `provider` varchar(255) not null, `credentials` text, `options` text, `date_created` datetime default CURRENT_TIMESTAMP, `user_created` char(36), `webhook_ids` json null, `webhook_secret` varchar(255) null, `last_synced_at` datetime null, foreign key(`user_created`) references `directus_users`(`id`) on delete SET NULL, primary key (`id`));
CREATE TABLE `directus_deployment_projects` (`id` char(36) not null, `deployment` char(36) not null, `external_id` varchar(255) not null, `name` varchar(255) not null, `date_created` datetime default CURRENT_TIMESTAMP, `user_created` char(36), `url` varchar(255) null, `framework` varchar(255) null, `deployable` boolean not null default '1', foreign key(`deployment`) references `directus_deployments`(`id`) on delete CASCADE, foreign key(`user_created`) references `directus_users`(`id`) on delete SET NULL, primary key (`id`));
CREATE TABLE `directus_deployment_runs` (`id` char(36) not null, `project` char(36) not null, `external_id` varchar(255) not null, `target` varchar(255) not null, `date_created` datetime default CURRENT_TIMESTAMP, `user_created` char(36), `status` varchar(255) null, `url` varchar(255) null, `started_at` datetime null, `completed_at` datetime null, foreign key(`project`) references `directus_deployment_projects`(`id`) on delete CASCADE, foreign key(`user_created`) references `directus_users`(`id`) on delete SET NULL, primary key (`id`));
CREATE TABLE IF NOT EXISTS "respostas_pendentes" (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `data_criacao` datetime NULL, `data_aprovacao` datetime NULL, `mensagem_id` integer NULL, `pessoa_id` integer NULL, `msg_original` text NULL, `resposta_ia` text NULL, `status` varchar(255) NULL, `resposta_final` text NULL, `classificacao` varchar(255) NULL, `confianca_ia` integer NULL, `aprovado_por` varchar(255) NULL, `tempo_aprovacao_seg` integer NULL, `observacao` text NULL, CONSTRAINT `respostas_pendentes_mensagem_id_foreign` FOREIGN KEY (`mensagem_id`) REFERENCES `mensagens` (`id`) ON DELETE SET NULL, CONSTRAINT `respostas_pendentes_pessoa_id_foreign` FOREIGN KEY (`pessoa_id`) REFERENCES `pessoas` (`id`) ON DELETE SET NULL, CONSTRAINT `respostas_pendentes_aprovado_por_foreign` FOREIGN KEY (`aprovado_por`) REFERENCES `directus_users` (`id`));
CREATE TABLE IF NOT EXISTS "correntes" (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `dia_semana` INTEGER NOT NULL UNIQUE, `nome` TEXT NOT NULL, `tema` TEXT, `versiculo` TEXT, `horario` json DEFAULT null);
CREATE TABLE `conversas` (`id` integer not null primary key autoincrement, `pessoa_id` integer null, `ultima_mensagem` text null, `status` varchar(255) null default 'ativa', `nao_lidas` integer null default '0', `tipo` varchar(255) null default 'whatsapp', `corrente_id` integer null, `ultimo_remetente` varchar(255) null, `ultima_data` datetime null, `criado_em` datetime null default '', `atualizado_em` datetime null default '');
CREATE TABLE `heartbeat` (`id` integer not null primary key autoincrement, `servico` varchar(255) null, `status` varchar(255) null, `status_code` integer null, `tempo_resposta_ms` integer null, `mensagem` text null, `timestamp` datetime null);
CREATE TABLE `base_conhecimento` (`id` integer not null primary key autoincrement, `categoria` varchar(255) null, `pergunta_modelo` text null, `resposta_modelo` text null, `confianca_minima` integer null, `tags` varchar(255) null, `versiculo_ref` varchar(255) null, `sort` integer null);
CREATE INDEX idx_pessoas_telefone ON pessoas(telefone);
CREATE INDEX idx_mensagens_pessoa ON mensagens(pessoa_id);
CREATE INDEX idx_mensagens_data ON mensagens(data_envio);
CREATE INDEX idx_metricas_data ON metricas_diarias(data);
CREATE INDEX idx_comunicados_tipo ON comunicados(tipo);
CREATE INDEX idx_pastores_igreja ON pastores(igreja_id);
CREATE INDEX idx_qrcodes_igreja ON qrcodes(igreja_id);
CREATE INDEX idx_pessoas_consentimento ON pessoas(consentimento);
CREATE INDEX idx_historico_data ON historico_broadcast(data_envio);
CREATE INDEX idx_auditoria_hash ON auditoria_consentimento(telefone_hash);
CREATE INDEX idx_programacao_tipo ON programacao(tipo);
CREATE INDEX idx_programacao_dia ON programacao(dia_semana);
CREATE UNIQUE INDEX `directus_operations_resolve_unique` on `directus_operations` (`resolve`);
CREATE UNIQUE INDEX `directus_operations_reject_unique` on `directus_operations` (`reject`);
CREATE UNIQUE INDEX `directus_users_external_identifier_unique` on `directus_users` (`external_identifier`);
CREATE UNIQUE INDEX `directus_users_email_unique` on `directus_users` (`email`);
CREATE UNIQUE INDEX `directus_users_token_unique` on `directus_users` (`token`);
CREATE UNIQUE INDEX `directus_flows_operation_unique` on `directus_flows` (`operation`);
CREATE INDEX `directus_activity_timestamp_index` ON `directus_activity` (`timestamp`);
CREATE INDEX `directus_revisions_parent_index` ON `directus_revisions` (`parent`);
CREATE INDEX `directus_revisions_activity_index` ON `directus_revisions` (`activity`);
CREATE UNIQUE INDEX `directus_deployments_provider_unique` on `directus_deployments` (`provider`);
CREATE UNIQUE INDEX `directus_deployment_projects_deployment_external_id_unique` on `directus_deployment_projects` (`deployment`, `external_id`);
CREATE TABLE `sugestoes_melhoria` (`id` integer not null primary key autoincrement, `categoria` varchar(255) null, `titulo` varchar(255) null, `descricao` text null, `impacto` varchar(255) null, `status` varchar(255) null, `dados_evidencia` json null, `criado_em` datetime null, `implementado_em` datetime null);
CREATE TABLE `postagens_agendadas` (`id` integer not null primary key autoincrement, `titulo` varchar(255) null, `conteudo` text null, `midia_url` varchar(255) null, `plataforma` varchar(255) null, `status` varchar(255) null, `postiz_id` varchar(255) null, `origem` varchar(255) null, `erro` text null, `data_publicacao` datetime null);
