# AGENTS.md — Moura Analytics

## 1. Contexto e objetivo

Este é um aplicativo de análise de vôlei de praia.

O usuário registra eventos de uma partida para dois atletas.
O sistema mantém o histórico e gera três relatórios PDF:
- Atleta 1.
- Atleta 2.
- Dupla.

O proprietário considera o comportamento atual a referência funcional.

A tarefa é acrescentar:
- Cadastro de atletas por perfil.
- Cadastro e reutilização de duplas.
- Link opcional do vídeo da partida.
- Dashboard da partida.
- Pequenos aprimoramentos visuais.
- Distribuição como aplicativo instalável no Windows.

Não interpretar esta tarefa como autorização para reescrever o sistema.

## 2. Tecnologias e escopo

Preservar:
- JavaScript.
- HTML e CSS.
- Node.js e Express.
- SQLite.
- Electron.
- PDFKit.

Não migrar para React, Python, outro banco ou outra arquitetura.

Dependências adicionais são permitidas quando necessárias ao escopo.
Justificar sua inclusão e manter o arquivo de lock consistente.

Não atualizar indiscriminadamente as dependências.

Não implementar funcionalidades extras apenas por parecerem interessantes.

## 3. Inspeção antes da implementação

Antes de modificar:
1. Ler o código existente e as instruções aplicáveis.
2. Identificar os fluxos de autenticação, partidas, eventos, placar,
   sets, desfazer, finalização, histórico e PDFs.
3. Identificar os cálculos e as classificações aceitas.
4. Verificar o banco realmente existente, além do script de criação.
5. Identificar testes e comandos disponíveis.
6. Apresentar um resumo curto dos achados e do plano.

Não presumir que uma função funciona corretamente apenas pelo seu nome.

Se encontrar uma divergência entre a regra solicitada e o comportamento
atual, explicar a divergência antes de alterar a regra esportiva.

## 4. Preservação das regras esportivas

Preservar:
- Fundamentos.
- Categorias de resultados.
- Regras de pontuação.
- Tratamento de sets.
- Fórmulas.
- Denominadores.
- Arredondamentos.
- Tratamento de valores ausentes.
- Critérios de aproveitamento e eficiência.

Não substituir uma regra por outra considerada mais comum no voleibol.

O código original contém funções como:
- gerarSqlEstatistica().
- buscarDadosRelatorio().
- getResultadosPorFundamento().

Confirmar sua implementação e reutilizar a lógica existente.

O dashboard não pode manter uma implementação independente das fórmulas
no frontend que possa divergir do relatório.

No código examinado, saque e bloqueio não calculam aproveitamento e
eficiência. Preservar esse comportamento, após confirmar no projeto.

Percentual de uma categoria é diferente de aproveitamento e eficiência.
Usar rótulos que deixem essa diferença explícita.

## 5. Preservação dos PDFs

Os três PDFs devem manter:
- Conteúdo.
- Organização.
- Aparência.
- Tabelas.
- Fórmulas.
- Valores.
- Arredondamentos.
- Fluxo de geração e download.

Não acrescentar fotos, clube, link do vídeo ou gráficos ao PDF.
Os novos campos são destinados ao cadastro e ao dashboard.

Antes de alterar código compartilhado com o PDF:
1. Criar partidas de referência em banco de teste.
2. Gerar os PDFs originais.
3. Registrar os valores esperados.
4. Depois da alteração, gerar novamente e comparar.

Comparar texto, números, quantidade de páginas e aparência renderizada.
Não depender apenas de comparação binária, pois metadados do arquivo
podem variar sem representar alteração de conteúdo.

Qualquer mudança necessária no acesso ao PDF deve preservar sua saída.

## 6. Cadastro de atletas versus posição na partida

ATENÇÃO:
Nos eventos atuais, id_atleta representa a posição 1 ou 2 na partida.

Esses valores não devem ser substituídos diretamente pelo ID global
do cadastro de atletas.

Implementar vínculos adicionais entre:
- Partida.
- Atleta cadastrado na posição 1.
- Atleta cadastrado na posição 2.

Preservar a compatibilidade com os eventos e PDFs antigos.

Não associar automaticamente registros antigos a atletas apenas porque
os nomes são iguais. Pessoas diferentes podem ter o mesmo nome.

Manter os nomes registrados na partida como referência histórica.
Editar o cadastro de um atleta não pode alterar PDFs antigos.

## 7. Propriedade dos dados

Atletas, duplas, fotos e partidas pertencem ao perfil autenticado.

O backend deve determinar o usuário pelo mecanismo de autenticação.
Não confiar em id_usuario enviado pelo cliente.

Validar propriedade em:
- Listagem.
- Consulta por ID.
- Criação de vínculos.
- Edição.
- Arquivamento.
- Acesso a fotos.
- Dashboard.
- PDF.
- Registro de evento.
- Desfazer evento.
- Finalização da partida.

Não basta esconder dados na interface.

Uma dupla só pode usar atletas pertencentes ao mesmo perfil autenticado.
Uma partida só pode usar duplas e atletas permitidos para esse perfil.

## 8. Banco de dados e migrações

Não apagar ou recriar o banco existente.

Usar migrações versionadas e repetíveis com segurança:
- Fazer backup consistente antes da migração.
- Usar transações quando aplicável.
- Preservar IDs, usuários, partidas, eventos e sets.
- Não duplicar dados ao reiniciar o aplicativo.
- Não sobrescrever um banco de destino existente.
- Tratar falhas sem deixar a base parcialmente migrada.

Inspecionar registros existentes sem expor dados pessoais em logs.

Se houver atletas antigos sem dono identificável, não atribuí-los
arbitrariamente a um perfil nem torná-los visíveis para todos.
Documentar o caso e pedir decisão somente se necessário.

Partidas antigas devem continuar acessíveis mesmo sem vínculos com
novos cadastros de atletas e duplas.

## 9. Interface e usabilidade

Preservar a identidade visual e o fluxo principal do sistema.

Permitir aprimoramentos leves:
- Espaçamento.
- Alinhamento.
- Tipografia.
- Contraste.
- Organização de informações.
- Consistência de botões e formulários.

Não redesenhar completamente a aplicação.

Manter a marcação rápida e familiar.

Incluir:
- Rótulos claros.
- Estados de carregamento.
- Mensagens de erro úteis.
- Estados vazios.
- Confirmação das operações relevantes.
- Navegação por teclado e foco visível.
- Proteção contra cliques duplicados durante gravações.

Não depender de cor como único meio de explicar um resultado.

## 10. Funcionamento local

As funções essenciais devem operar sem internet:
- Login e cadastro local.
- Atletas e fotos.
- Duplas.
- Partidas.
- Eventos.
- Dashboard.
- Histórico.
- PDFs.

Abrir o vídeo externo pode exigir internet.
Não prometer reprodução offline de vídeos externos.

Não depender de CDN para bibliotecas, fontes ou gráficos essenciais.

Guardar banco e fotos em diretório de dados do usuário.
Não gravar dados mutáveis dentro da pasta instalada ou do pacote ASAR.

Não distribuir dados pessoais, banco de desenvolvimento ou segredos
do ambiente de desenvolvimento.

Manter o backend acessível somente no próprio computador.

## 11. Testes

Usar banco temporário e dados fictícios.
Nunca rodar testes destrutivos na base real.

Criar testes que verifiquem comportamento observável.
Não construir os valores esperados chamando a mesma função testada.

Cobrir:
- Regras atuais e todos os fundamentos.
- Categorias de resultados.
- Separação entre atleta 1, atleta 2 e dupla.
- Partidas sem eventos.
- Filtros por set.
- Percentuais e arredondamentos.
- PDFs.
- Autenticação e isolamento entre duas contas.
- Cadastros e fotos.
- Duplas.
- Persistência.
- Migração de banco antigo.
- Fluxos existentes de marcação, desfazer e finalização.

Após alterar algo que falhou, repetir os testes afetados.

Conferir visualmente as telas, além dos testes automatizados.

## 12. Entrega e honestidade

Não declarar sucesso sem evidências.

Distinguir:
- Implementado.
- Testado automaticamente.
- Verificado visualmente.
- Validado no aplicativo instalado.
- Pendente de validação.

Se não houver ambiente Windows, não declarar o instalador validado.

Entregar:
- Código.
- Instruções de execução.
- Comandos de teste.
- Instruções de empacotamento.
- Instalador, se a geração for possível.
- Resumo dos testes.
- Limitações e verificações pendentes.

Não alterar testes para esconder uma regressão.
Não remover funcionalidades existentes para fazer testes passarem.
