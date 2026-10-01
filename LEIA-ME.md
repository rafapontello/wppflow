# WPP Flow — login e protótipos salvos (Supabase + Vercel)

## O que mudou

- **Login com e-mail e senha.** Tem cadastro, entrada e "esqueci a senha". Só e-mails **@dtidigital.com.br** conseguem criar conta.
- **Meus protótipos.** Cada pessoa vê só os próprios protótipos. Dá para criar, abrir, **renomear**, duplicar, excluir e buscar pelo nome.
- **Salvamento automático.** O editor salva sozinho 2 segundos depois de cada alteração. Também salva pelo botão **Salvar** ou com **Ctrl/Cmd + S**. A barra do topo mostra se está salvo, e o nome do projeto pode ser renomeado ali mesmo.
- **Compartilhar.** Gera um link só de visualização, que abre sem login. O link pode ser ligado e desligado a qualquer momento.
- O editor continua o mesmo de antes, com todas as telas, exportação em PNG/GIF, tema escuro e o resto.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `index.html` | Página principal. Carrega os outros arquivos. |
| `config.js` | **Único arquivo que você precisa editar:** URL e chave do Supabase. |
| `app.js` | Login, lista de protótipos, barra do editor e compartilhamento. |
| `db.js` | Conversa com o Supabase. Tem também um "modo local" para testes. |
| `editor.js` | O editor original, já compilado. Não precisa mexer. |
| `supabase.sql` | Script que cria a tabela e as regras de segurança no Supabase. |

Enquanto o `config.js` estiver vazio, a plataforma abre em **modo local**, com uma faixa amarela no topo: tudo funciona, mas os dados ficam salvos só naquele navegador. Isso serve para testar antes de configurar o Supabase.

---

## Passo a passo

### 1. Criar o projeto no Supabase (5 min)

1. Acesse [supabase.com](https://supabase.com), entre com sua conta e clique em **New project**. Se o outro projeto da dti já usa Supabase, crie dentro da mesma *Organization* para facilitar o acesso do time.
2. Nome: `wppflow`. Região: **South America (São Paulo)**. Crie uma senha forte para o banco e guarde num cofre de senhas.
3. Aguarde uns 2 minutos até o projeto ficar pronto.

### 2. Criar a tabela (2 min)

1. No menu lateral, abra **SQL Editor → New query**.
2. Cole todo o conteúdo de `supabase.sql` e clique em **Run**. A mensagem esperada é *Success. No rows returned*.

O script faz três coisas:

- cria a tabela `prototypes`;
- ativa as regras que impedem uma pessoa de ver os protótipos de outra;
- bloqueia cadastros fora do domínio @dtidigital.com.br.

### 3. Configurar o login

**Authentication → URL Configuration**

- **Site URL:** `https://wppflow-topaz.vercel.app`
- **Redirect URLs:** adicione `https://wppflow-topaz.vercel.app/**`

Isso garante que os links de confirmação e de "esqueci a senha" voltem para a plataforma.

**Authentication → Sign In / Providers → Email:** deixe *Enable Email provider* ligado.

**Sobre o envio de e-mails (importante):** o servidor de e-mail que já vem no Supabase só envia para quem é membro do projeto, e tem um limite bem baixo de envios por hora. Para liberar o uso pelo time, escolha uma das opções:

- **A. Recomendada: configurar um SMTP próprio.** Fica em **Project Settings → Authentication → SMTP Settings**. Pode ser o SMTP do Google Workspace da dti (peça ao TI) ou um serviço como o Resend, que tem plano gratuito. Com isso, a confirmação de conta e o "esqueci a senha" funcionam para todo mundo.
- **B. Para um piloto rápido: desligar a confirmação de e-mail.** Em **Sign In / Providers → Email**, desmarque *Confirm email*. A pessoa entra assim que cria a conta. O risco é que alguém consiga criar conta com um e-mail @dtidigital que não é dele. Além disso, o "esqueci a senha" continua dependendo do envio de e-mail.

Opcional: em **Authentication → Email Templates**, traduza os textos dos e-mails para português.

### 4. Conectar a plataforma ao Supabase (1 min)

1. No Supabase, abra **Project Settings → API**. Em projetos novos, o caminho é **Data API** e **API Keys**.
2. Copie a **Project URL** e a chave **anon / public**. Em projetos novos, ela se chama *publishable key* e começa com `sb_publishable_`.
3. Cole as duas no `config.js`:

```js
window.WPPFLOW_CONFIG = {
  SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
  SUPABASE_ANON_KEY: "cole-a-chave-aqui",
  ALLOWED_DOMAIN: "dtidigital.com.br",
};
```

Essa chave pode ficar no código porque ela é pública. Quem protege os dados são as regras criadas no passo 2. **Nunca** coloque a chave `service_role` / *secret* no `config.js`.

### 5. Publicar na Vercel

A pasta tem vários arquivos, então não basta substituir só o `index.html`. Escolha o caminho que corresponde a como o projeto foi publicado:

**Se o projeto está ligado a um repositório no GitHub** (confira em Vercel → projeto → Settings → Git)

Substitua o conteúdo do repositório por esta pasta e faça o commit. A Vercel publica sozinha.

**Se foi publicado pela Vercel CLI, ou se você não tem certeza**

```bash
npm i -g vercel        # uma vez só
cd pasta-wppflow
vercel link            # escolha o projeto "wppflow" que já existe
vercel --prod
```

O link `wppflow-topaz.vercel.app` continua o mesmo.

### 6. Testar

- [ ] Criar conta com um e-mail @dtidigital.com.br e confirmar pelo e-mail
- [ ] Tentar criar conta com um Gmail: tem que ser bloqueado
- [ ] Criar um protótipo, editar e ver a barra do topo mudar para "Salvo às…"
- [ ] Recarregar a página: o protótipo continua lá
- [ ] Renomear pela lista e pela barra do editor
- [ ] Compartilhar → ligar o link → abrir numa janela anônima
- [ ] Entrar com outra conta: os protótipos da primeira não podem aparecer

---

## Bom saber

- **Imagens:** avatar e imagens enviadas no editor ficam salvas dentro do protótipo, no banco. Para o uso normal, isso funciona bem. Se os protótipos ficarem muito pesados, com dezenas de imagens grandes, o próximo passo é mover as imagens para o *Supabase Storage*.
- **Protótipos da versão antiga:** a versão anterior não salvava nada. Por isso não há dados para migrar.
- **Plano gratuito do Supabase:** comporta tranquilamente um time interno. Um projeto sem acesso por 7 dias é pausado e volta com um clique no painel. Se a plataforma virar ferramenta do dia a dia, vale o plano Pro.
- **Manutenção do editor:** mudanças em login, lista ou compartilhamento são feitas no `app.js`, que é legível. O `editor.js` é a versão compilada do editor original. Para mudar o editor em si (novos componentes, telas etc.), o ideal é recuperar o código-fonte React original. Se ele não existir mais, ainda dá para fazer ajustes pontuais direto no `editor.js`.
- **Cloudflare:** não é necessário, porque o Supabase cuida do login e do banco. Se quiserem padronizar com o outro projeto da dti, esta mesma pasta pode ser publicada no Cloudflare Pages sem mudar nada no código. Só é preciso atualizar a Site URL e as Redirect URLs no Supabase.
