# Implementação de Áudio no WhatsApp CRM

## 📋 Resumo

Este documento descreve como implementar o suporte a áudio no webhook existente do N8N (`wa-enviar`). O frontend já foi atualizado para enviar áudios, agora é necessário adicionar os nós no N8N para processar essas mensagens.

---

## 🎯 Fluxo Implementado

### Frontend (✅ Concluído)

1. **AudioRecorder.tsx** — Componente para gravar áudio via microfone
   - Usa MediaRecorder API
   - Formato: WebM com codec Opus
   - Mostra duração em tempo real

2. **ChatWindow.tsx** — Atualizado com:
   - Player de áudio para mensagens recebidas
   - Botão de microfone para gravar
   - Botão de clipe para anexar arquivo
   - Exibição de transcrição abaixo do player

3. **useWhatsApp.ts** — Adicionada função `sendAudio()`
   - Converte Blob para base64
   - Envia para o webhook `wa-enviar` com `message_type: "audio"`
   - Payload inclui: `audio_base64`, `audio_duration`, `conversation_id`, etc.

---

## 🔧 Configuração N8N Necessária

### Webhook Existente: `wa-enviar`

Você precisa **adicionar um nó condicional** ao webhook existente para diferenciar entre texto e áudio.

#### Payload que o Frontend Envia para Áudio:

```json
{
  "conversation_id": "uuid",
  "remote_jid": "5511999999999@s.whatsapp.net",
  "message_type": "audio",
  "audio_base64": "SUQzBAAAI1...",
  "audio_duration": 15,
  "sent_by": "user-id",
  "sent_by_name": "Nome do Especialista"
}
```

#### Payload que o Frontend Envia para Texto (Existente):

```json
{
  "conversation_id": "uuid",
  "remote_jid": "5511999999999@s.whatsapp.net",
  "body": "Texto da mensagem",
  "sent_by": "user-id",
  "sent_by_name": "Nome do Especialista"
}
```

---

## 📝 Nós N8N a Implementar

### 1. Nó Condicional (IF)

**Condição:**
```
message_type == "audio"
```

**Ramo TRUE:** → Fluxo de Áudio (veja abaixo)
**Ramo FALSE:** → Fluxo de Texto Existente

---

### 2. Fluxo de Áudio (Ramo TRUE)

#### 2.1 Nó HTTP — Converter Base64 para Arquivo

**Descrição:** Salvar o áudio em base64 no Supabase Storage

**Nó:** HTTP Request
- **URL:** `https://{SEU_PROJETO}.supabase.co/storage/v1/object/wa-media/{timestamp}.webm`
- **Método:** POST
- **Headers:**
  ```
  Authorization: Bearer {SEU_SUPABASE_ANON_KEY}
  Content-Type: application/octet-stream
  ```
- **Body (Raw):**
  ```
  {{ Buffer.from($json.audio_base64, 'base64') }}
  ```

**Saída esperada:**
```json
{
  "id": "arquivo.webm",
  "name": "arquivo.webm",
  "owner": "..."
}
```

#### 2.2 Nó HTTP — Obter URL Pública do Áudio

**Nó:** HTTP Request
- **URL:** `https://{SEU_PROJETO}.supabase.co/storage/v1/object/public/wa-media/{id_do_arquivo}`
- **Método:** GET

**Saída esperada:**
```
https://{SEU_PROJETO}.supabase.co/storage/v1/object/public/wa-media/arquivo.webm
```

#### 2.3 Nó HTTP — Enviar para Evolution API

**Nó:** HTTP Request
- **URL:** `{{ $env.EVOLUTION_API_URL }}/message/sendWhatsAppAudio/{{ $env.EVOLUTION_INSTANCE }}`
- **Método:** POST
- **Headers:**
  ```
  Authorization: Bearer {{ $env.EVOLUTION_API_KEY }}
  Content-Type: application/json
  ```
- **Body:**
  ```json
  {
    "number": "{{ $json.remote_jid.replace('@s.whatsapp.net', '') }}",
    "audio": "{{ $json.audio_base64 }}",
    "encoding": true
  }
  ```

#### 2.4 Nó Supabase — Salvar na Tabela `wa_messages`

**Nó:** Supabase Insert
- **Tabela:** `wa_messages`
- **Dados:**
  ```json
  {
    "conversation_id": "{{ $json.conversation_id }}",
    "direction": "outbound",
    "message_type": "audio",
    "body": null,
    "media_url": "{{ URL_PÚBLICA_DO_ÁUDIO }}",
    "wa_message_id": "{{ $json.wa_message_id }}",
    "sent_by": "{{ $json.sent_by }}",
    "sent_by_name": "{{ $json.sent_by_name }}",
    "status": "sent",
    "created_at": "{{ now().toIso() }}"
  }
  ```

---

## 🎙️ Fluxo de Recebimento (Webhook `wa-receber`)

Quando um contato enviar áudio, o N8N já recebe:

```json
{
  "messageType": "audioMessage",
  "message": {
    "media": {
      "url": "https://...",
      "mediaKey": "...",
      "mimetype": "audio/ogg; codecs=opus"
    }
  }
}
```

**Nós a Adicionar:**

### 1. Nó Condicional (IF)

**Condição:**
```
messageType == "audioMessage"
```

### 2. Nó HTTP — Baixar Áudio

**Nó:** HTTP Request
- **URL:** `{{ $json.message.media.url }}`
- **Método:** GET
- **Response Format:** Binary

### 3. Nó HTTP — Salvar no Supabase Storage

Mesmo processo do envio (seção 2.1 acima)

### 4. Nó HTTP — Transcrever com OpenAI Whisper (Opcional)

**Nó:** HTTP Request
- **URL:** `https://api.openai.com/v1/audio/transcriptions`
- **Método:** POST
- **Headers:**
  ```
  Authorization: Bearer {{ $env.OPENAI_API_KEY }}
  ```
- **Body (Form Data):**
  - `file`: [arquivo de áudio]
  - `model`: `whisper-1`
  - `language`: `pt`

**Saída:**
```json
{
  "text": "Transcrição do áudio..."
}
```

### 5. Nó Supabase — Salvar na Tabela `wa_messages`

**Nó:** Supabase Insert
- **Tabela:** `wa_messages`
- **Dados:**
  ```json
  {
    "conversation_id": "{{ $json.conversation_id }}",
    "direction": "inbound",
    "message_type": "audio",
    "body": "{{ TRANSCRIÇÃO_DO_WHISPER }}",
    "media_url": "{{ URL_PÚBLICA_DO_SUPABASE }}",
    "wa_message_id": "{{ $json.message.key.id }}",
    "sent_by": "{{ $json.message.fromMe ? 'system' : 'contact' }}",
    "sent_by_name": "{{ $json.pushName }}",
    "status": "received",
    "created_at": "{{ now().toIso() }}"
  }
  ```

---

## 🗄️ Estrutura do Banco de Dados

A tabela `wa_messages` já possui os campos necessários:

```sql
CREATE TABLE wa_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL,
  direction TEXT NOT NULL, -- 'inbound' | 'outbound'
  message_type TEXT NOT NULL, -- 'text' | 'audio' | 'image' | 'video' | 'document'
  body TEXT, -- Texto ou transcrição
  media_url TEXT, -- URL do áudio no Supabase Storage
  wa_message_id TEXT,
  sent_by UUID,
  sent_by_name TEXT,
  status TEXT, -- 'sent' | 'delivered' | 'read' | 'failed'
  created_at TIMESTAMP
);
```

---

## 📦 Bucket Supabase

Você precisa criar um bucket público no Supabase:

**Nome:** `wa-media`
**Público:** Sim
**CORS:** Permitir leitura pública

---

## 🔐 Variáveis de Ambiente N8N

Adicione ao seu N8N:

```
EVOLUTION_API_URL=https://api.evolution.com.br
EVOLUTION_INSTANCE=seu-instance-name
EVOLUTION_API_KEY=sua-api-key
OPENAI_API_KEY=sua-openai-key
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-anon-key
```

---

## ✅ Checklist de Implementação

- [ ] Criar bucket `wa-media` no Supabase
- [ ] Adicionar nó condicional ao webhook `wa-enviar`
- [ ] Implementar fluxo de envio de áudio (seção 2)
- [ ] Testar envio de áudio via frontend
- [ ] Adicionar nó condicional ao webhook `wa-receber`
- [ ] Implementar fluxo de recebimento de áudio
- [ ] Adicionar integração com OpenAI Whisper (opcional)
- [ ] Testar recebimento e transcrição de áudio

---

## 🧪 Testes

### Teste 1: Enviar Áudio via Microfone

1. Abra o CRM no navegador
2. Selecione uma conversa
3. Clique no botão de microfone
4. Grave um áudio curto (5-10 segundos)
5. Verifique se o áudio aparece na conversa com status "sent"

### Teste 2: Enviar Áudio via Arquivo

1. Clique no botão de clipe
2. Selecione um arquivo MP3 ou WebM
3. Verifique se o áudio é enviado

### Teste 3: Receber Áudio

1. Envie um áudio via WhatsApp para o número da instância
2. Verifique se aparece no CRM com player
3. Verifique se a transcrição aparece abaixo do player

---

## 🐛 Troubleshooting

### Erro: "Não foi possível acessar o microfone"

**Solução:** Verifique se o navegador tem permissão para acessar o microfone. Alguns navegadores exigem HTTPS.

### Erro: "Falha ao enviar áudio"

**Solução:** Verifique se o webhook N8N está respondendo corretamente. Adicione logs no N8N para debugar.

### Áudio não aparece no WhatsApp

**Solução:** Verifique se a Evolution API está configurada corretamente e se o formato do áudio é suportado.

### Transcrição vazia

**Solução:** Verifique se a API Key do OpenAI está correta e se o áudio é audível.

---

## 📚 Referências

- [Evolution API - Audio Message](https://docs.evolution.com.br/api/messages/audio)
- [OpenAI Whisper API](https://platform.openai.com/docs/api-reference/audio)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)

---

## 📞 Suporte

Para dúvidas ou problemas, entre em contato com a equipe de desenvolvimento.
