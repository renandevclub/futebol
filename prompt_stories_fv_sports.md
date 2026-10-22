# Análise e implementação de Stories na Resenha do F&V Sports

Analise o projeto completo, principalmente as funcionalidades atuais do feed, e implemente a possibilidade de os usuários publicarem e visualizarem Stories, sem prejudicar as funcionalidades existentes.

Use como referência as imagens anexadas e analise as duas plataformas:

- Facebook: [https://m.facebook.com/](https://m.facebook.com/)
- Instagram: [https://www.instagram.com/](https://www.instagram.com/)

## 1. Análise das referências

Estude a lógica de funcionamento dos Stories do Facebook e do Instagram, considerando a apresentação visual, a publicação de fotos e vídeos, a visualização em tela cheia, a duração das publicações e a experiência de uso em dispositivos móveis.

Compare as duas referências e escolha a abordagem mais adequada para o F&V Sports, levando em consideração a identidade visual, a estrutura atual do projeto e sua finalidade esportiva.

## 2. Interface e experiência do usuário

Implemente uma área horizontal de Stories na parte superior do feed, inspirada principalmente no formato compacto do Instagram, aproveitando os elementos do Facebook que forem úteis.

A interface deverá incluir:

- **Criar Story:** botão com o avatar do usuário e um indicador de adição (+).
- **Stories publicados:** exibir a foto de perfil dos usuários com Stories ativos, usando um contorno visual para indicar publicações disponíveis e diferenciar as que ainda não foram visualizadas.
- **Visualização:** abrir o Story em tela cheia, com navegação entre as publicações, indicador de progresso e opção de fechar.
- **Responsividade:** garantir uma boa experiência em celulares, tablets e computadores, priorizando a navegação por dispositivos móveis.
- **Integração com o feed:** manter o visual consistente com o restante do F&V Sports, sem duplicar ou prejudicar as publicações convencionais.

## 3. Funcionalidades de publicação

Permita que o usuário autenticado publique Stories utilizando fotos e vídeos do dispositivo, com uma prévia do conteúdo antes da publicação.

Implemente, conforme compatibilidade com a arquitetura atual:

- Legenda ou texto opcional.
- Envio seguro de arquivos e armazenamento das mídias.
- Data e hora da publicação.
- Expiração automática após 24 horas.
- Registro das visualizações.
- Exclusão dos próprios Stories.
- Feedback visual durante o envio, em caso de sucesso ou erro.

Não permita publicar arquivos inválidos ou que ultrapassem os limites definidos pelo projeto. Evite que mídias expiradas continuem aparecendo no feed ou possam ser acessadas indevidamente.

## 4. Integração com as ligas do F&V Sports

Analise como o projeto organiza usuários, ligas e partidas antes de definir quem poderá visualizar cada Story.

Priorize a exibição de Stories relevantes para a comunidade esportiva do usuário, respeitando as regras de acesso existentes. Não exiba indiscriminadamente conteúdo de ligas das quais o usuário não participa quando houver restrições de acesso.

Avalie também a possibilidade de utilizar os Stories para compartilhar momentos de partidas, resultados, bastidores e atividades dos jogadores, sem tornar obrigatória a associação de todo Story a uma partida.

## 5. Banco de dados, armazenamento e segurança

Antes de realizar alterações, analise a estrutura atual do banco de dados, a autenticação e o armazenamento de arquivos.

Implemente a solução utilizando a infraestrutura já adotada pelo projeto, preservando os dados existentes e evitando tabelas ou funcionalidades duplicadas.

Garanta que:

- Cada Story esteja associado ao usuário que o publicou.
- As permissões de publicação, leitura e exclusão sejam aplicadas corretamente.
- As políticas de segurança do banco de dados e do armazenamento impeçam acessos não autorizados.
- As visualizações sejam registradas de forma consistente.
- A expiração seja controlada pelo servidor ou por mecanismos confiáveis, e não apenas pela interface.
- Os arquivos antigos sejam tratados de maneira adequada, evitando acúmulo desnecessário de mídias.

## 6. Notificações e desempenho

Verifique se a implementação pode aproveitar o sistema de notificações já existente, sem criar notificações excessivas.

Se fizer sentido para a arquitetura atual, considere sinalizar novos Stories apenas para usuários relevantes, respeitando a participação nas ligas e as preferências existentes.

Otimize o carregamento das imagens, a reprodução dos vídeos e as consultas ao banco de dados. Evite carregar todas as mídias de uma vez e preserve o desempenho da página inicial, especialmente em conexões móveis.

## 7. Execução e validação

Antes de programar, examine o projeto e identifique os componentes, tabelas, políticas de segurança e funcionalidades que precisarão ser aproveitados ou modificados.

Depois, implemente a solução completa, seguindo os padrões de código e design já utilizados.

Ao finalizar, teste os principais cenários:

- Criar e visualizar um Story.
- Navegar entre Stories e identificar os já visualizados.
- Publicar fotos e vídeos.
- Excluir um Story próprio.
- Verificar a expiração após 24 horas.
- Confirmar as permissões de acesso entre usuários e ligas.
- Testar a interface em celulares e computadores.
- Confirmar que o feed atual e as demais funcionalidades continuam funcionando normalmente.

Não utilize dados fictícios para simular funcionalidades concluídas. Não remova recursos existentes sem necessidade e não altere regras de negócio que não estejam relacionadas a esta implementação.

**Objetivo final:** entregar uma funcionalidade de Stories completa, moderna, responsiva, segura e integrada ao F&V Sports, combinando as melhores características visuais e funcionais do Facebook e do Instagram com as necessidades específicas de uma comunidade de futebol e vôlei.
