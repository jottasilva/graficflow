# Requirements Document

## Introduction

A página de **Setores** no painel GraficFlow (`SectorsView`) deve permitir que administradores e operadores autorizados visualizem e gerenciem quais usuários estão vinculados a cada setor. A funcionalidade é o inverso do que já existe na página de Usuários (onde se vê os setores de um usuário): aqui, partindo de um setor, deve ser possível ver seus usuários, adicionar novos vínculos, remover vínculos individuais, e aceitar que um setor fique sem nenhum usuário vinculado. Os vínculos são persistidos na tabela `user_sector_permissions` já existente no banco de dados.

## Glossary

- **SectorsView**: Componente React que renderiza a página de Setores no painel GraficFlow.
- **Setor**: Área produtiva cadastrada no sistema (ex.: Impressão, Acabamento), representada pelo tipo `Sector`.
- **Usuário**: Conta de operador ou administrador do sistema, representada pelo tipo `UserAccount`.
- **Vínculo**: Relação entre um `Usuário` e um `Setor`, persistida como uma linha na tabela `user_sector_permissions`.
- **SectorUsersPanel**: Subcomponente da `SectorsView` responsável por exibir e gerenciar os vínculos de usuários de um setor específico.
- **UsersService**: Serviço backend que gerencia usuários e seus vínculos com setores via `replaceSectorLinks`.
- **API de Usuários**: Endpoints REST `/api/users` (GET, PATCH) utilizados para leitura e atualização de vínculos de setor por usuário.
- **Permissão `users:write`**: Permissão necessária para adicionar ou remover vínculos de usuário em um setor.
- **Permissão `users:read`**: Permissão necessária para visualizar usuários vinculados a um setor.

---

## Requirements

### Requirement 1: Exibir usuários vinculados ao setor

**User Story:** Como administrador, quero ver quais usuários estão vinculados a cada setor na página de Setores, para que eu possa auditar e gerenciar a composição de cada área produtiva sem sair da página.

#### Acceptance Criteria

1. THE `SectorsView` SHALL exibir, para cada card de setor, uma seção `SectorUsersPanel` listando os nomes dos usuários cujo `sectorIds` inclui o `id` daquele setor.
2. WHEN a lista de usuários vinculados a um setor estiver vazia, THE `SectorUsersPanel` SHALL exibir a mensagem "Nenhum usuário vinculado" naquele card.
3. THE `SectorUsersPanel` SHALL exibir o nome completo e o avatar (ou iniciais do nome, caso `avatarUrl` esteja vazio) de cada usuário vinculado.
4. WHILE o carregamento inicial dos usuários estiver em andamento, THE `SectorsView` SHALL exibir um indicador de carregamento no lugar da lista de usuários vinculados.
5. IF a requisição de listagem de usuários falhar, THEN THE `SectorsView` SHALL exibir uma mensagem de erro descritiva e um botão para tentar novamente.

---

### Requirement 2: Adicionar usuário a um setor

**User Story:** Como administrador, quero adicionar um usuário a um setor diretamente na página de Setores, para que eu possa vincular rapidamente operadores às suas áreas de trabalho.

#### Acceptance Criteria

1. THE `SectorUsersPanel` SHALL exibir um controle de seleção (dropdown ou busca) listando apenas os usuários do tenant que ainda **não** estão vinculados ao setor em questão.
2. WHEN o administrador seleciona um usuário no controle e confirma a ação, THE `SectorUsersPanel` SHALL chamar `PATCH /api/users/:id` com o `sectorIds` atualizado incluindo o `id` do setor.
3. WHEN o vínculo for criado com sucesso, THE `SectorUsersPanel` SHALL atualizar imediatamente a lista de usuários exibida no card do setor, sem recarregar a página.
4. IF o controle de seleção não tiver nenhum usuário disponível para adicionar (todos já estão vinculados), THEN THE `SectorUsersPanel` SHALL desabilitar o controle e exibir o texto "Todos os usuários já estão vinculados".
5. WHILE a requisição de adição de vínculo estiver em andamento, THE `SectorUsersPanel` SHALL desabilitar o controle de seleção e o botão de confirmação para evitar submissões duplicadas.
6. IF a requisição de adição de vínculo falhar, THEN THE `SectorUsersPanel` SHALL exibir uma mensagem de erro via toast e restaurar o estado anterior da lista.

---

### Requirement 3: Remover vínculo de usuário de um setor

**User Story:** Como administrador, quero remover o vínculo de um usuário específico de um setor, para que eu possa corrigir atribuições incorretas sem afetar os demais vínculos do usuário.

#### Acceptance Criteria

1. THE `SectorUsersPanel` SHALL exibir, ao lado do nome de cada usuário vinculado, um botão de remoção (ícone de "X" ou lixeira).
2. WHEN o administrador clica no botão de remoção de um usuário, THE `SectorUsersPanel` SHALL chamar `PATCH /api/users/:id` com o `sectorIds` atualizado **excluindo** o `id` do setor corrente.
3. WHEN o vínculo for removido com sucesso, THE `SectorUsersPanel` SHALL atualizar imediatamente a lista do card do setor, removendo aquele usuário da exibição.
4. WHEN todos os vínculos de usuários de um setor forem removidos, THE `SectorUsersPanel` SHALL exibir "Nenhum usuário vinculado" naquele card (setor pode ficar sem usuários).
5. WHILE a requisição de remoção de vínculo estiver em andamento, THE `SectorUsersPanel` SHALL desabilitar o botão de remoção do usuário em questão para evitar cliques duplicados.
6. IF a requisição de remoção de vínculo falhar, THEN THE `SectorUsersPanel` SHALL exibir uma mensagem de erro via toast e manter o usuário na lista.

---

### Requirement 4: Controle de acesso para gerenciar vínculos

**User Story:** Como sistema, quero garantir que apenas usuários autorizados possam adicionar ou remover vínculos, para que a integridade dos dados de acesso por setor seja preservada.

#### Acceptance Criteria

1. WHILE o usuário autenticado possuir a permissão `users:write` ou a permissão `*`, THE `SectorUsersPanel` SHALL exibir os controles de adição e remoção de vínculos.
2. WHILE o usuário autenticado **não** possuir a permissão `users:write` nem a permissão `*`, THE `SectorUsersPanel` SHALL exibir a lista de usuários vinculados em modo somente leitura, sem os controles de adição ou remoção.
3. THE `SectorsView` SHALL exibir a seção de vínculos de usuários — em modo somente leitura — para qualquer usuário que possua apenas `users:read`, sem exibir os controles de adição ou remoção.
4. IF a requisição ao backend retornar erro `403 Forbidden`, THEN THE `SectorUsersPanel` SHALL exibir a mensagem "Sem permissão para gerenciar vínculos deste setor".

---

### Requirement 5: Consistência de dados entre as páginas de Usuários e de Setores

**User Story:** Como sistema, quero garantir que alterações de vínculo feitas na página de Setores sejam refletidas na página de Usuários, e vice-versa, para que o estado da aplicação seja sempre coerente.

#### Acceptance Criteria

1. WHEN um vínculo é adicionado ou removido na `SectorsView`, THE `SectorsView` SHALL atualizar o estado local de `users` (lista de `UserAccount`) para refletir o `sectorIds` modificado, de modo que a página de Usuários exiba o estado correto ao ser navegada sem necessidade de recarregamento.
2. THE `SectorsView` SHALL receber a lista de `UserAccount` já carregada pelo estado global da aplicação, evitando requisições duplicadas de listagem de usuários.
3. WHEN o usuário navega da `SectorsView` para a página de Usuários e de volta, THE `SectorsView` SHALL preservar o estado de usuários vinculados sem recarregar os dados da API.
