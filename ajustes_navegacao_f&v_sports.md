# Análise e Reorganização da Navegação do F&V Sports

Antes de realizar qualquer alteração, **analise todo o projeto**, especialmente a estrutura de navegação, as rotas, o sistema de autenticação e o relacionamento entre usuários e ligas. Utilize a imagem de referência para identificar o menu de navegação inferior da versão mobile.

O objetivo é simplificar a navegação do F&V Sports, remover atalhos duplicados e implementar uma navegação inteligente para as funcionalidades de partidas e resenha, preservando todas as funcionalidades existentes.

## 1. Definir os itens finais do menu inferior mobile

Quero que o menu inferior mobile tenha exatamente os seguintes quatro itens, nesta ordem:

1. **Partidas:** acesso às partidas das ligas das quais o usuário participa.
2. **Resenha:** acesso ao feed de publicações da liga desejada.
3. **Meu Caixa:** acesso à funcionalidade financeira existente.
4. **Perfil:** acesso ao perfil do usuário e às funcionalidades relacionadas à sua conta.

A opção **Tabela deve ser removida do menu inferior**. Essa alteração deve remover somente o atalho de navegação, sem excluir páginas, dados ou funcionalidades que ainda sejam utilizadas em outras áreas do sistema.

O item **Meu Caixa deve permanecer no menu inferior**, sem alterações desnecessárias em sua funcionalidade.

## 2. Ajustar o tamanho e a distribuição do menu inferior

Redimensione o menu inferior para acomodar os quatro itens de maneira equilibrada e responsiva.

Requisitos visuais:

- Distribuir os quatro itens uniformemente pela largura disponível.
- Ajustar o tamanho dos ícones, textos, espaçamentos e áreas clicáveis para evitar sobreposição ou cortes.
- Manter os nomes legíveis em telas pequenas.
- Preservar o estilo visual atual do F&V Sports, incluindo cores, ícones e destaque do item selecionado.
- Considerar a área segura inferior dos celulares para evitar que o menu fique encoberto pela interface do aparelho.
- Evitar que o menu ocupe espaço vertical excessivo ou prejudique o conteúdo das páginas.
- Garantir o funcionamento em diferentes resoluções e dispositivos móveis.

Não reduza apenas os ícones. Ajuste também o espaçamento, o alinhamento, a tipografia e a altura do componente conforme necessário, mantendo uma aparência profissional.

## 3. Remover o atalho de Perfil do cabeçalho superior

Atualmente, existe um atalho de perfil no cabeçalho superior, ao lado do botão do menu hambúrguer.

Quero remover somente esse atalho do cabeçalho, pois o acesso ao perfil será feito pelo menu inferior.

Após a alteração:

- Manter o logotipo do F&V Sports.
- Preservar os demais elementos existentes, como notificações, alternância de tema e menu hambúrguer, conforme a implementação atual.
- Remover o botão ou avatar de perfil localizado próximo ao menu hambúrguer.
- Reorganizar o espaçamento e o alinhamento dos elementos restantes para manter o cabeçalho equilibrado.
- Garantir que o cabeçalho continue responsivo em dispositivos móveis e desktops.

**Importante:** não exclua a página de perfil, suas rotas, seus componentes ou suas funcionalidades. Remova somente o atalho do cabeçalho superior e mantenha o acesso pelo menu inferior.

## 4. Implementar a navegação inteligente de Resenha

Ao clicar em Resenha, o sistema deve verificar de quais ligas o usuário autenticado participa.

- **Participa de uma única liga:** redirecionar diretamente para o feed dessa liga.
- **Participa de duas ou mais ligas:** apresentar uma tela ou modal para escolher a liga cujo feed deseja visualizar.
- **Não participa de nenhuma liga:** apresentar uma mensagem informativa e uma opção para explorar ligas e participar de uma.

A seleção deve exibir somente as ligas às quais o usuário tem acesso. Após a escolha, abrir o feed correspondente à liga selecionada.

## 5. Implementar a mesma lógica para Partidas

A opção Partidas deve seguir a mesma lógica de navegação inteligente utilizada em Resenha.

- **Participa de uma única liga:** abrir diretamente a área de partidas dessa liga.
- **Participa de duas ou mais ligas:** apresentar uma tela ou modal para selecionar a liga desejada.
- **Não participa de nenhuma liga:** apresentar uma mensagem informativa com uma opção para explorar ligas.

Após a seleção, abrir as partidas da liga escolhida, respeitando as permissões e as funcionalidades existentes.

Reutilize os componentes, as rotas e as consultas existentes sempre que possível, evitando duplicação de código e de regras de negócio.

## 6. Segurança e preservação das funcionalidades

Antes de implementar as mudanças:

1. Identifique como o sistema determina a participação de cada usuário nas ligas.
2. Verifique as rotas existentes para partidas, feeds e perfis.
3. Confirme como funciona atualmente o acesso ao Meu Caixa.
4. Preserve a autenticação, as permissões, os dados e as funcionalidades existentes.
5. Garanta que a seleção de liga e o acesso às informações respeitem as regras de autorização do sistema e do banco de dados.
6. Trate estados de carregamento, falhas nas consultas e usuários sem ligas associadas.
7. Não crie páginas duplicadas nem utilize dados fictícios para simular o funcionamento.
8. Verifique se as alterações afetam outras páginas ou componentes compartilhados.

A remoção de Tabela do menu inferior não deve apagar sua funcionalidade do sistema. Da mesma forma, remover Perfil do cabeçalho não deve excluir a página de perfil.

## 7. Testes e resultado esperado

Após concluir as alterações, teste o comportamento em dispositivos móveis e desktops.

Verifique se:

- O menu inferior apresenta somente **Partidas, Resenha, Meu Caixa e Perfil**, exatamente nessa ordem.
- A opção Tabela não aparece mais no menu inferior.
- Meu Caixa continua no menu inferior e funciona normalmente.
- O atalho de Perfil não aparece mais no cabeçalho superior.
- O perfil continua acessível pelo menu inferior.
- O menu hambúrguer e os demais elementos do cabeçalho continuam funcionando.
- Os quatro itens do menu inferior estão bem dimensionados, legíveis e sem sobreposição.
- Partidas e Resenha direcionam corretamente os usuários conforme a quantidade de ligas das quais participam.
- Não houve perda de funcionalidades nem regressões na navegação.

Ao finalizar, apresente um resumo dos arquivos alterados, das mudanças implementadas e dos testes realizados.

**Orientação final:** analise primeiro o código existente e implemente as alterações de forma compatível com a arquitetura atual do F&V Sports. Não refaça funcionalidades que já estão funcionando, não exclua dados e não remova páginas sem necessidade. A mudança principal é reorganizar o menu inferior, remover Tabela desse menu, manter Meu Caixa e transferir o acesso de Perfil do cabeçalho superior para o menu inferior.
