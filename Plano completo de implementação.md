# Plano completo de implementação

## Cadastro, login, convites, recuperação de senha e gerenciamento de usuários

**Sistema:** F&V Sports  
**Stack identificada:** Next.js, Supabase Auth, banco Supabase/PostgreSQL e interface web responsiva  
**Escopo:** usuários, autenticação, convites, recuperação de senha, bloqueio/reativação, duplicidades, permissões e auditoria

---

## 1. Objetivo do projeto

Implementar um sistema seguro e integrado ao F&V Sports para:

- permitir cadastro com ou sem convite;
- manter o login atual por WhatsApp e senha;
- impedir contas duplicadas pelo mesmo número normalizado;
- registrar a origem de cada cadastro;
- permitir que o superadministrador consulte e gerencie todos os usuários;
- criar, consultar e revogar convites opcionais;
- permitir recuperação de senha por código temporário gerado pelo superadministrador;
- bloquear, liberar e reativar contas sem apagar seus dados;
- preservar histórico, relacionamentos, partidas, ligas e demais informações existentes;
- proteger todas as operações no servidor e no banco, não apenas na interface;
- manter a identidade visual atual e a responsividade do sistema.

O plano não substitui o Supabase Auth nem cria uma autenticação paralela.

---

## 2. Decisões técnicas principais

### 2.1. Autenticação

Manter o modelo atual:

- o usuário informa o número de WhatsApp;
- o sistema normaliza o telefone;
- o número normalizado é convertido no identificador interno de autenticação já utilizado pelo projeto;
- o Supabase Auth valida a senha;
- o perfil da aplicação é carregado pela relação com `auth_id`.

O número de WhatsApp continua sendo o identificador de login apresentado ao usuário. A senha continua sendo a credencial principal.

### 2.2. Convite opcional

O convite será uma camada de autorização e rastreabilidade do cadastro. Ele não será:

- senha;
- código de login;
- substituto do WhatsApp;
- código de recuperação;
- requisito obrigatório para cadastro.

O cadastro sem convite deverá continuar funcionando normalmente.

### 2.3. Recuperação de senha

A recuperação administrativa deverá alterar a senha da conta existente. Ela nunca poderá criar um usuário novo.

A operação privilegiada deverá ocorrer em uma **Supabase Edge Function** ou endpoint seguro no servidor, porque a `service_role key` não pode ser exposta no navegador.

### 2.4. Bloqueio de conta

O bloqueio será registrado no banco e verificado no servidor. Ocultar menus ou impedir a navegação pelo front-end não será considerado suficiente.

### 2.5. Unicidade do WhatsApp

O telefone será armazenado em formato normalizado e deverá possuir restrição de unicidade no banco, depois que os conflitos existentes forem identificados e tratados.

---

## 3. Fase 0 — preparação e proteção dos dados

Antes de alterar o código:

1. Confirmar o repositório, a branch de produção e o processo atual de deploy.
2. Criar uma branch exclusiva para a implementação.
3. Fazer backup do banco e verificar se o backup pode ser restaurado.
4. Registrar a versão atual da aplicação e das migrações.
5. Mapear as variáveis de ambiente usadas no frontend, backend e deploy.
6. Criar ambiente de homologação ou projeto Supabase separado, quando possível.
7. Definir quem será o superadministrador principal.
8. Confirmar como os usuários atuais, ligas, partidas e relacionamentos serão preservados.
9. Não executar exclusões, mesclagens ou redefinições em contas reais durante a primeira fase.

### Resultado esperado

Existe uma cópia segura dos dados, uma branch de trabalho e um ambiente onde as migrações podem ser testadas sem risco para a produção.

---

## 4. Fase 1 — auditoria técnica do sistema atual

### 4.1. Front-end

Mapear:

- componentes de login e cadastro;
- rotas públicas e protegidas;
- modal ou página atual de autenticação;
- página administrativa de usuários;
- hook/contexto de autenticação;
- tratamento de erros;
- carregamento e restauração de sessão;
- chamadas diretas ao Supabase;
- componentes que verificam `admin` e `super_admin`;
- telas de perfil e edição de dados.

### 4.2. Banco de dados

Inspecionar:

- `auth.users`;
- tabela `profiles`;
- tabela de funções ou permissões, se existir;
- relacionamentos com ligas, partidas, membros, pagamentos, posts e histórico;
- colunas de criação e último acesso;
- chaves estrangeiras;
- índices;
- constraints;
- triggers;
- funções RPC;
- políticas RLS;
- tabelas que armazenam dados financeiros ou históricos.

### 4.3. Autenticação

Confirmar:

- formato do identificador interno criado a partir do WhatsApp;
- configuração de confirmação de e-mail ou telefone;
- expiração e renovação de sessão;
- comportamento de `signUp`, `signInWithPassword`, `signOut` e `getSession`;
- possibilidade de redefinir senha via Admin API dentro de uma Edge Function;
- comportamento após bloqueio de uma conta com sessão já existente.

### 4.4. Auditoria de segurança

Verificar se existe algum código que:

- usa `service_role` no cliente;
- permite alterar perfis de terceiros diretamente pelo navegador;
- confia em `role` enviado pelo frontend;
- permite vincular perfil a `auth_id` somente pelo telefone sem proteção adicional;
- cria perfil durante login sem validação suficiente;
- lista dados privados de outros usuários;
- expõe e-mails técnicos ou tokens na interface.

### Resultado esperado

Um inventário técnico com os objetos atuais e uma lista de riscos antes da primeira migração.

---

## 5. Fase 2 — diagnóstico e prevenção de duplicidades

### 5.1. Normalização única

Centralizar a normalização do WhatsApp em uma função única, usada pelo front-end, pelas funções do banco e pelas Edge Functions.

A função deverá:

- remover espaços, símbolos, parênteses e hífens;
- validar DDD;
- validar quantidade de dígitos;
- tratar o código do país `55` de forma consistente;
- armazenar uma única representação oficial;
- rejeitar números inválidos;
- não utilizar apenas o nome para identificar uma pessoa.

### 5.2. Levantamento de duplicidades

Criar uma consulta administrativa que agrupe perfis por telefone normalizado e identifique:

- mesmo número em formatos diferentes;
- perfis com `auth_id` vazio;
- mais de um perfil para o mesmo `auth_id`;
- contas Auth sem perfil correspondente;
- perfis sem usuário Auth correspondente;
- possíveis duplicidades com nomes parecidos, apenas como sinalização e nunca como decisão automática.

### 5.3. Tratamento manual

Para cada possível duplicidade:

1. identificar a conta correta;
2. conferir histórico, ligas, partidas e relacionamentos;
3. escolher uma conta principal;
4. planejar a migração dos relacionamentos, se necessária;
5. registrar a decisão;
6. somente depois aplicar a alteração;
7. não excluir a conta antiga sem confirmação e backup.

### 5.4. Restrição no banco

Depois do saneamento:

- adicionar coluna normalizada, se necessário;
- criar índice único para telefone normalizado;
- garantir que valores nulos sejam tratados de forma consciente;
- impedir que o cadastro contorne a validação usando outro formato do mesmo número.

### Resultado esperado

O sistema deixa de depender apenas de uma consulta prévia no front-end e passa a ter proteção contra concorrência e duplicação no banco.

---

## 6. Fase 3 — modelo de dados

A modelagem abaixo é recomendada. Os nomes devem ser ajustados aos nomes reais do projeto após a auditoria.

### 6.1. Alterações em `profiles`

Adicionar, caso ainda não existam:

- `whatsapp_normalized`: telefone oficial usado para unicidade;
- `account_status`: `active`, `blocked`, `pending` ou outro conjunto pequeno e documentado;
- `signup_origin`: `with_invite` ou `without_invite`;
- `invite_id`: referência ao convite utilizado, nula quando não houver convite;
- `blocked_at`;
- `blocked_by`;
- `unblocked_at`;
- `unblocked_by`;
- `last_login_at`;
- `last_password_recovery_at`;
- `created_at`, caso ainda não exista;
- `updated_at`;
- `status_reason`, opcional, para justificativa administrativa.

A origem do cadastro deverá possuir constraint para aceitar somente os valores previstos.

### 6.2. Tabela `user_invites`

Campos recomendados:

- `id` UUID;
- `code_hash` texto, nunca o código puro;
- `code_hint` opcional, contendo apenas uma pequena identificação não reutilizável;
- `created_by` UUID do superadministrador;
- `created_at`;
- `expires_at`;
- `revoked_at`;
- `revoked_by`;
- `used_at`;
- `used_by` UUID do perfil criado;
- `status`, derivado ou controlado por estados válidos;
- `max_uses`, inicialmente 1;
- `use_count`, inicialmente 0;
- `note`, opcional.

O código completo deve ser mostrado somente na criação. Não deve ser armazenado em texto aberto.

### 6.3. Tabela `password_recovery_requests`

Campos recomendados:

- `id` UUID;
- `target_profile_id`;
- `code_hash`;
- `created_by`;
- `created_at`;
- `expires_at`;
- `used_at`;
- `invalidated_at`;
- `attempt_count`;
- `max_attempts`;
- `last_attempt_at`;
- `status`;
- `ip_hash` ou metadado mínimo de abuso, sem armazenar dados desnecessários.

O código puro nunca deve ser salvo.

### 6.4. Tabela `admin_audit_logs`

Campos recomendados:

- `id` UUID;
- `actor_user_id`;
- `target_user_id`, quando aplicável;
- `action`;
- `entity_type`;
- `entity_id`;
- `metadata` JSONB sem senha, token ou código completo;
- `success`;
- `error_code`, quando houver;
- `created_at`.

A auditoria deve registrar, no mínimo:

- criação e revogação de convite;
- uso de convite;
- geração, invalidação e uso de recuperação;
- bloqueio, liberação e reativação;
- mudança de função;
- alterações administrativas relevantes;
- tentativas administrativas recusadas.

### 6.5. Tabela opcional `user_sessions_control`

Usar somente se a estratégia escolhida exigir revogação explícita de sessões. Caso contrário, manter o controle pelo status da conta e pelas verificações no servidor.

---

## 7. Fase 4 — funções seguras no banco e no servidor

### 7.1. Funções de autorização

Criar uma função segura para verificar o superadministrador usando a identidade autenticada da sessão, por exemplo:

- obter o usuário autenticado pelo JWT;
- consultar o perfil correspondente;
- validar `role = super_admin`;
- não aceitar `user_id` ou `role` fornecido pelo navegador como prova de autorização.

A função deve ser usada por RPCs, políticas e Edge Functions administrativas.

### 7.2. Cadastro com ou sem convite

Implementar uma operação de cadastro que:

1. valida o nome;
2. normaliza e valida o WhatsApp;
3. valida a senha pelos critérios atuais;
4. verifica a unicidade no banco;
5. se houver convite, valida hash, expiração, revogação e uso;
6. cria a identidade no Supabase Auth;
7. cria ou vincula o perfil corretamente;
8. grava `signup_origin`;
9. grava `invite_id` somente se o convite foi realmente utilizado;
10. consome o convite de forma atômica;
11. desfaz ou sinaliza inconsistências caso alguma etapa falhe.

O ideal é impedir que a criação do perfil e o consumo do convite ocorram em estados parcialmente concluídos.

### 7.3. Consumo atômico de convite

A validação e o consumo devem ocorrer em transação ou função que bloqueie o registro do convite. Dois cadastros simultâneos não podem consumir o mesmo código.

### 7.4. Recuperação por código

Criar duas operações separadas:

**Gerar recuperação:**

- somente superadministrador;
- selecionar usuário por identificador seguro;
- confirmar a conta selecionada;
- invalidar código anterior da mesma conta;
- gerar token aleatório de alta entropia;
- armazenar somente hash;
- definir validade curta e limite de tentativas;
- registrar auditoria;
- devolver o código uma única vez.

**Usar recuperação:**

- receber código e identificador necessário;
- localizar por hash de forma segura;
- validar conta, expiração, status e tentativas;
- exigir nova senha forte;
- alterar a senha da conta Auth existente;
- marcar o código como usado;
- atualizar data de recuperação;
- registrar auditoria sem salvar o código.

O código não deve criar sessão administrativa nem permitir acesso antes da troca da senha.

### 7.5. Bloqueio e reativação

Operações protegidas:

- bloquear conta;
- reativar conta;
- impedir que o superadministrador bloqueie sua conta principal;
- impedir bloqueio do último superadministrador sem substituto;
- exigir confirmação no front-end;
- registrar motivo, ator e data;
- preservar todos os dados do usuário.

Toda operação protegida deve verificar o status atual do perfil no servidor.

---

## 8. Fase 5 — políticas RLS e isolamento de dados

Revisar ou criar políticas para garantir:

- usuário comum consulta apenas seus próprios dados privados;
- usuários não consultam códigos, hashes ou logs administrativos;
- somente superadministrador consulta todos os perfis administrativos;
- somente superadministrador cria e revoga convites;
- somente superadministrador gera recuperação para terceiros;
- usuários não alteram sua própria função administrativa por chamada direta;
- usuários bloqueados não executam operações protegidas;
- Edge Functions usam chave privilegiada somente no ambiente seguro;
- a chave privilegiada nunca aparece em variáveis públicas, bundle ou navegador.

As políticas devem ser testadas diretamente com diferentes perfis, não apenas através da interface.

---

## 9. Fase 6 — alterações de interface

### 9.1. Cadastro

Manter os campos atuais e acrescentar:

- campo opcional de convite;
- indicação clara de que o convite não é obrigatório;
- validação do convite somente quando preenchido;
- mensagens específicas para convite inválido, expirado ou já utilizado;
- confirmação de sucesso;
- prevenção contra duplo envio;
- tratamento para telefone já cadastrado.

### 9.2. Login

Manter:

- WhatsApp;
- senha;
- mensagens genéricas para credenciais inválidas;
- aviso apropriado para conta bloqueada;
- estado de carregamento;
- logout e restauração de sessão.

Adicionar link ou instrução para recuperação orientada pelo superadministrador, se essa for a decisão operacional.

### 9.3. Painel do superadministrador

Criar uma área exclusiva com quatro seções:

#### Usuários

- total de usuários;
- busca por nome, WhatsApp e identificador;
- filtros por origem, função e situação;
- ordenação por nome, cadastro e último acesso;
- paginação;
- coluna de origem com rótulos “Com convite” e “Sem convite”;
- coluna de status;
- detalhes individuais;
- ações de bloquear, reativar e gerar recuperação;
- indicador de possível duplicidade.

#### Convites

- criar convite;
- definir validade;
- copiar código após criação;
- consultar disponíveis, usados, expirados e revogados;
- revogar convite não utilizado;
- consultar data de criação, uso e usuário associado.

#### Recuperações

- consultar histórico sem exibir códigos;
- identificar conta alvo;
- informar status: criado, usado, expirado, invalidado;
- gerar novo código;
- invalidar códigos anteriores automaticamente.

#### Auditoria

- filtrar por ação, ator, alvo e data;
- exibir sucesso ou falha;
- nunca mostrar senha, token ou código completo.

### 9.4. Responsividade

No celular:

- substituir tabela larga por cartões;
- manter filtros acessíveis;
- usar botões de toque adequados;
- usar confirmação em modal ou tela própria;
- permitir copiar código com uma ação clara;
- evitar informações sensíveis expostas em listas.

No desktop:

- usar tabela com colunas organizadas;
- paginação e filtros persistentes;
- painel lateral ou modal para detalhes.

---

## 10. Fase 7 — bloqueio e sessões existentes

Escolher e documentar uma política de sessão:

1. ao bloquear, marcar o perfil como `blocked`;
2. impedir novas autenticações para contas bloqueadas;
3. verificar o status em operações protegidas;
4. no cliente, reagir a respostas de acesso negado e limpar a sessão;
5. para recursos críticos, usar função de servidor que valide o status atual;
6. avaliar revogação de refresh tokens quando o provedor e a arquitetura permitirem;
7. testar uma sessão aberta em outro navegador durante o bloqueio.

Critério mínimo: uma conta bloqueada não pode continuar utilizando funcionalidades protegidas apenas porque possuía uma sessão antiga.

---

## 11. Fase 8 — estratégia para dados existentes

### 11.1. Compatibilidade

As migrações devem:

- adicionar campos sem apagar os existentes;
- usar valores padrão apenas quando forem semanticamente corretos;
- preencher origem antiga como `without_invite` somente se não houver evidência de convite;
- não inventar convites;
- manter `invite_id` nulo quando a origem não puder ser comprovada;
- preservar datas, nomes, histórico e relacionamentos.

### 11.2. Usuários antigos

Para contas já existentes:

- manter acesso ativo inicialmente, salvo indicação administrativa;
- preencher status como `active`;
- registrar origem desconhecida ou sem convite conforme decisão documentada;
- não exigir que o usuário refaça cadastro;
- não gerar nova conta Auth.

### 11.3. Duplicidades antigas

Gerar relatório de possíveis duplicidades. O relatório deverá ser revisado antes de qualquer união. A correção será feita por lote pequeno, com backup e log de cada ação.

---

## 12. Fase 9 — testes obrigatórios

### 12.1. Cadastro

- cadastro válido sem convite;
- cadastro válido com convite;
- campo de convite vazio não bloqueia o cadastro;
- convite inválido é rejeitado;
- convite expirado é rejeitado;
- convite revogado é rejeitado;
- convite já utilizado é rejeitado;
- convite só pode ser usado uma vez;
- telefone em formatos diferentes resulta no mesmo número normalizado;
- telefone existente impede nova conta;
- senha curta é rejeitada;
- senha igual ao telefone é rejeitada;
- duplo clique não cria duas contas;
- falha parcial não deixa convite consumido indevidamente.

### 12.2. Login

- login válido;
- senha inválida;
- telefone inválido;
- conta bloqueada;
- logout;
- restauração da sessão;
- sessão expirada;
- usuário sem perfil correspondente;
- conta Auth sem cadastro duplicado automático.

### 12.3. Recuperação

- somente superadministrador gera código;
- usuário comum não gera código para terceiros;
- código é mostrado somente uma vez;
- código inválido é rejeitado;
- código expirado é rejeitado;
- código usado novamente é rejeitado;
- excesso de tentativas bloqueia a validação;
- novo código invalida o anterior;
- nova senha é aplicada à conta original;
- recuperação não cria novo perfil;
- login com WhatsApp e nova senha funciona;
- senha e código não aparecem em logs.

### 12.4. Bloqueio

- superadministrador bloqueia usuário comum;
- usuário bloqueado não inicia novo acesso;
- sessão antiga bloqueada perde acesso protegido;
- reativação restaura o acesso;
- dados e histórico permanecem intactos;
- superadministrador não consegue bloquear a própria conta principal;
- não é possível deixar o sistema sem superadministrador válido.

### 12.5. Permissões e RLS

Testar cada operação com:

- visitante;
- usuário comum;
- administrador comum;
- superadministrador;
- conta bloqueada;
- token expirado;
- requisição manipulada fora da interface.

### 12.6. Interface

- desktop;
- tablet;
- celular;
- modo claro;
- modo escuro;
- estados vazios;
- falha de rede;
- carregamento;
- paginação;
- filtros combinados;
- cópia do código no celular.

---

## 13. Estratégia de implantação

### 13.1. Migrações

Executar em etapas pequenas e reversíveis:

1. criar tabelas novas;
2. criar funções e índices sem alterar comportamento atual;
3. adicionar colunas compatíveis;
4. preencher dados derivados em lote controlado;
5. validar inconsistências;
6. ativar constraints depois do saneamento;
7. publicar as funções de cadastro e administração;
8. ativar as novas telas;
9. monitorar erros.

### 13.2. Feature flags

Quando possível, ativar por configuração:

- cadastro com convite;
- painel novo;
- recuperação administrativa;
- bloqueio efetivo;
- restrição de unicidade.

Isso permite desligar uma função sem reverter todo o deploy.

### 13.3. Publicação gradual

1. homologação com dados anonimizados ou projeto separado;
2. teste com usuários internos;
3. validação do superadministrador;
4. backup de produção;
5. migração de produção;
6. deploy do frontend;
7. teste de fumaça;
8. monitoramento de erros e logs;
9. comunicação das novas regras aos usuários.

---

## 14. Observabilidade e operação

Monitorar:

- falhas de login;
- tentativas de cadastro duplicado;
- convites inválidos;
- tentativas de recuperação excedidas;
- bloqueios e reativações;
- erros de RLS;
- falhas de Edge Functions;
- divergência entre `auth.users` e `profiles`;
- criação de usuários sem origem registrada.

Criar uma rotina administrativa para revisar:

- contas duplicadas;
- perfis sem `auth_id`;
- Auth users sem perfil;
- convites presos em estado inconsistente;
- recuperações expiradas;
- ações administrativas suspeitas.

---

## 15. Critérios de aceite

A implementação será considerada concluída quando todos os itens abaixo forem verdadeiros:

1. É possível cadastrar com convite válido.
2. É possível cadastrar sem convite.
3. A ausência do convite não impede o cadastro.
4. A origem fica registrada como com convite ou sem convite.
5. O convite utilizado fica relacionado ao usuário correto.
6. O mesmo convite não pode ser usado duas vezes.
7. O login continua usando WhatsApp e senha.
8. O mesmo WhatsApp normalizado não cria duas contas.
9. Todos os usuários aparecem no painel do superadministrador.
10. O painel permite busca, filtros, paginação e detalhes.
11. O superadministrador consegue criar e revogar convites.
12. O superadministrador consegue gerar recuperação para a conta correta.
13. O código de recuperação não é armazenado em texto aberto.
14. O código expira, possui limite de tentativas e é invalidado após uso.
15. A recuperação altera a conta existente e não cria nova conta.
16. O usuário consegue entrar com a nova senha.
17. O superadministrador consegue bloquear e reativar usuários.
18. O bloqueio funciona no servidor e não apenas na interface.
19. O bloqueio não apaga dados ou histórico.
20. Usuários comuns não conseguem executar operações administrativas manipulando o frontend.
21. Nenhuma chave privilegiada é exposta no navegador.
22. As ações administrativas ficam registradas em auditoria.
23. Os dados atuais permanecem preservados.
24. O sistema funciona em celular e computador.
25. O deploy de produção passa por teste de fumaça e rollback documentado.

---

## 16. Ordem final de execução

### Entrega 1 — diagnóstico

Auditoria de código, banco, RLS, duplicidades e ambiente de deploy.

### Entrega 2 — fundação de segurança

Normalização única, status de conta, origem, auditoria, funções de autorização e migrações iniciais.

### Entrega 3 — cadastro e convites

Cadastro opcional com convite, consumo atômico, painel de convites e identificação da origem.

### Entrega 4 — usuários

Lista completa, busca, filtros, detalhes, bloqueio e reativação.

### Entrega 5 — recuperação

Edge Function segura, código temporário, troca de senha na conta existente e histórico.

### Entrega 6 — testes e publicação

Testes automatizados e manuais, validação de permissões, homologação, deploy gradual e monitoramento.

---

## 17. Decisões que devem ser confirmadas antes do desenvolvimento

1. O convite terá validade padrão de quantos dias?
2. O código de recuperação ficará válido por quanto tempo? Recomenda-se prazo curto, como 15 a 30 minutos.
3. O superadministrador enviará o código manualmente pelo WhatsApp?
4. O sistema deverá exigir confirmação adicional da identidade do usuário antes da troca de senha?
5. Usuários antigos sem origem comprovada aparecerão como “Sem convite” ou “Origem não registrada”?
6. O bloqueio deverá revogar imediatamente todas as sessões existentes?
7. Haverá mais de um superadministrador?
8. Quais ações exigirão justificativa obrigatória?
9. Deve existir exportação do painel para CSV?
10. Qual será o procedimento aprovado para tratar duplicidades existentes?

---

## Conclusão

A melhor implementação é incremental: primeiro proteger e entender os dados atuais, depois criar a fundação de segurança, em seguida implementar convites e gerenciamento de usuários, e somente então liberar a recuperação administrativa de senha.

O ponto mais importante é não resolver o problema apenas com uma tela nova. A origem do cadastro, a unicidade do WhatsApp, o bloqueio e a recuperação precisam ser garantidos por banco, RLS e funções seguras. Dessa forma, o sistema preserva o login atual, evita novas duplicidades e permite que o superadministrador gerencie contas sem expor credenciais privilegiadas.
