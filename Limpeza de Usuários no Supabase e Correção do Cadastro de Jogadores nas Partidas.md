# Limpeza de Usuários no Supabase e Correção do Cadastro de Jogadores nas Partidas

Quero que você analise o projeto e utilize o **MCP do Supabase** para realizar as alterações necessárias no banco de dados e no código da aplicação, seguindo rigorosamente os requisitos abaixo.

## 1. Excluir usuários sem WhatsApp cadastrado

Utilize o MCP do Supabase para identificar e excluir completamente do banco de dados os usuários que não possuem um número de WhatsApp cadastrado.

Antes de realizar a exclusão:

- Analise a estrutura do banco de dados e identifique todas as tabelas relacionadas aos usuários.
- Verifique como os registros da tabela `profiles` estão relacionados à tabela de autenticação do Supabase (`auth.users`) e às demais tabelas do sistema.
- Identifique os usuários que realmente não possuem WhatsApp cadastrado, considerando valores nulos, vazios ou compostos apenas por espaços.
- Verifique as dependências e os relacionamentos desses usuários com outras tabelas para evitar inconsistências ou a exclusão indevida de dados.

Após essa análise, exclua os usuários identificados de forma completa e consistente, incluindo seus registros de autenticação e perfis associados, quando aplicável.

**Importante:** não exclua usuários que possuam um WhatsApp válido cadastrado. Preserve os dados dos demais usuários e os registros legítimos das partidas. Se houver dependências que impeçam uma exclusão segura, identifique-as e resolva-as de maneira controlada, sem apagar dados válidos de outros usuários.

## 2. Impedir que jogadores adicionados manualmente sejam cadastrados na tabela `profiles`

Atualmente, quero corrigir o comportamento do sistema para que os jogadores adicionados manualmente pelo **administrador da liga ou pelo criador da partida** sejam registrados exclusivamente na partida em que foram adicionados, sem gerar registros desnecessários na tabela `profiles`.

O comportamento desejado é o seguinte:

- O administrador da liga pode adicionar jogadores manualmente a uma partida.
- O criador da partida também pode adicionar jogadores manualmente.
- Quando um desses responsáveis adicionar um jogador manualmente, os dados desse jogador deverão ser armazenados somente nos registros da partida, utilizando a estrutura apropriada do banco de dados.
- A operação não deverá criar automaticamente um novo usuário em `auth.users`, nem inserir um novo registro na tabela `profiles`.
- O jogador adicionado manualmente deverá aparecer normalmente na partida, com seu nome e as demais informações necessárias para o funcionamento do sistema.
- O registro deverá permanecer associado à partida correspondente, sem criar uma conta de usuário ou um perfil global indevidamente.

## 3. Separar corretamente os jogadores cadastrados dos jogadores adicionados manualmente

Analise e ajuste a lógica do sistema para diferenciar claramente estas duas situações:

**A. Usuário cadastrado no sistema**

- Possui uma conta válida no sistema.
- Possui um perfil registrado na tabela `profiles`.
- Pode ser associado às partidas por meio do relacionamento apropriado com seu usuário.

**B. Jogador adicionado manualmente a uma partida**

- Não precisa possuir uma conta no sistema.
- Não deve ser cadastrado automaticamente em `auth.users` ou na tabela `profiles`.
- Deve existir apenas como um registro vinculado à partida em que foi adicionado.
- Não deve aparecer como um usuário global ou cadastrado em outras áreas do sistema.

Caso a estrutura atual do banco de dados não permita essa separação corretamente, analise e implemente uma solução adequada, preservando os relacionamentos existentes e evitando duplicações.

## 4. Verificações e testes obrigatórios

Depois de realizar as alterações:

1. Verifique se todos os usuários sem WhatsApp cadastrado foram tratados corretamente.
2. Confirme que usuários com WhatsApp válido continuam intactos.
3. Teste a inclusão manual de jogadores pelo administrador da liga.
4. Teste a inclusão manual de jogadores pelo criador da partida.
5. Confirme que esses jogadores aparecem normalmente na partida.
6. Confirme que a inclusão manual não cria registros em `auth.users` ou `profiles`.
7. Verifique se os usuários cadastrados normalmente continuam podendo participar das partidas.
8. Revise as políticas RLS, as chaves estrangeiras, as funções, os gatilhos e as operações do banco de dados que possam interferir nesse comportamento.
9. Verifique se a alteração não prejudica o placar ao vivo, as escalações, o histórico das partidas ou as demais funcionalidades que dependam dos jogadores.

## 5. Resultado esperado

Quero que o banco de dados mantenha uma separação correta entre os usuários que possuem cadastro no sistema e os jogadores adicionados manualmente a partidas específicas.

Utilize o MCP do Supabase para executar as alterações necessárias e revise também o código da aplicação para garantir que o comportamento seja consistente entre o frontend e o backend.

**Não faça alterações desnecessárias em outras funcionalidades.** Preserve os dados válidos, evite exclusões em cascata indevidas e não utilize dados fictícios para simular os resultados.

Ao finalizar, apresente um resumo do que foi alterado, quais registros foram excluídos, quais tabelas ou arquivos foram modificados e quais testes foram realizados. Informe também qualquer limitação ou problema que não tenha sido resolvido.
