# Inspeção anterior à implementação

Foi lido `AGENTS.md` na raiz do aplicativo. Não havia outros AGENTS aplicáveis encontrados no projeto. Sem reescrita de arquitetura e sem alteração do banco pessoal.

## Inicialização original

`main.js` criava um processo `node server.js` via shell, com cwd `Backend`, e abria `Frontend/login.html` após um atraso fixo de dois segundos. Dependia de Node do sistema e porta 3000. Os três scripts do frontend tinham endereço fixo `http://localhost:3000`. Não havia instalador ou testes declarados nos pacotes.

## Banco e fluxos

`Backend/database/connection.js` abria `Backend/database/moura.db` com better-sqlite3. `init.js` criava as tabelas `usuarios`, `partidas`, `eventos_partida`, `sets_partida` e `atletas`. O banco real foi aberto somente para leitura, sem imprimir nomes, emails ou outros dados pessoais: 2 usuários, 6 partidas, 378 eventos, 15 sets e nenhum atleta no cadastro antigo. O esquema real correspondia ao inicializador.

Login/cadastro usam bcryptjs e JWT. A listagem de partidas e o relatório verificavam perfil, mas registrar, desfazer e finalizar confiavam no ID de partida sem conferir dono. Os eventos usam `id_atleta` como **posição 1/2**, nunca como ID de atleta cadastrado.

O frontend registra um fundamento/categoria por clique; o placar é preenchido separadamente ao finalizar. Não há inferência de pontos a partir da quantidade de fundamentos. Desfazer remove o evento de maior ID. A validação da tela aceita sets 1/2 com ao menos 21 pontos, set 3 com ao menos 15, sempre diferença mínima de 2. Essa regra foi preservada e aplicada também no backend. Não foi acrescentada uma regra nova exigindo vitória em determinado número de sets antes de permitir um terceiro set.

## Estatísticas originais

Em `Backend/server.js`, `gerarSqlEstatistica`, `getResultadosPorFundamento` e `buscarDadosRelatorio` concentram os cálculos e a consulta. Denominador: **COUNT(*) do fundamento**, com filtro da posição. Arredondamento SQL em duas casas. Aproveitamento = acertos / total × 100; eficiência = (acertos − erros) / total × 100. Sem eventos, os cálculos aplicáveis retornam 0; os não aplicáveis retornam NULL.

| Fundamento | Categorias declaradas no mapa original | Acertos | Erros para eficiência |
|---|---|---|---|
| Ataque | ponto, neutro, bloqueado, erro | ponto | erro e bloqueado |
| Saque | ace, bom, neutro, erro | ace, bom, neutro | erro; sem aproveitamento/eficiência |
| Passe | excelente, bom, regular, ruim, erro | excelente, bom, regular | erro |
| Bloqueio | ponto, neutro, erro | ponto | erro; sem aproveitamento/eficiência |
| Defesa | excelente, acao, erro | excelente | erro |
| Side-out | ponto, neutro, erro | ponto | erro e bloqueado |
| Contra-ataque | ponto, neutro, bloqueado, erro | ponto | erro e bloqueado |

A interface original também oferece **bloqueado em side-out**. O SQL já o conta no denominador e nos erros; o detalhamento original também o inclui quando existe no banco. Essa divergência foi comunicada antes das mudanças. O mapa/PDF permanece preservado. O dashboard mostra essa categoria, inclusive quando tem quantidade zero, para cobrir os botões reais.

## Três PDFs

A rota `GET /relatorio/:id_partida/:tipo/pdf` aceita `atleta1`, `atleta2` ou `dupla`, aplica propriedade, consulta os mesmos dados e desenha com PDFKit. Há identificação da partida, placares, tabela consolidada, detalhamento e data de emissão. O frontend baixa um Blob com nome de arquivo por tipo e ID.

Antes de modificar a lógica compartilhada, foram criadas duas partidas fictícias: uma com todas as categorias, duas posições, três placares e eficiência negativa; outra sem eventos. Os seis PDFs, esquema legado, estatísticas e hash do servidor foram gravados em `tests/reference/`. O primeiro teste independente foi executado antes da alteração.

Comportamentos herdados foram preservados: a formatação da data interpreta ISO sem horário em UTC e formata no fuso America/Maceio, podendo mostrar o dia anterior; a tabela consolidada ocupa largura maior que a área útil do A4. A aparência não foi redesenhada porque a tarefa exige equivalência dos PDFs originais. Nenhum campo novo foi inserido no relatório.

## Riscos e tratamento

- Trocar IDs globais pelas posições faria eventos pertencerem a outra pessoa: criados vínculos adicionais e snapshots de nomes, sem reatribuição automática.
- Rotas de gravação permitiam IDs de outro perfil: todas as novas operações e mutações de partidas conferem dono no backend.
- Mudanças de regras/denominadores entre dashboard e PDF: mesma consulta SQL; novo filtro opcional sem modificar a chamada do PDF.
- Cliques duplicados e ordem das operações: botão pendente, fila de marcação e idempotência transacional por perfil/chave; o set é capturado no instante do clique.
- Respostas assíncronas fora de ordem: AbortController e contador de versão no dashboard.
- Fotos malformadas, arquivos com nomes inseguros ou acesso cruzado: decodificação Sharp, limites, UUID e rota autenticada.
- Instalação, cwd, ABI nativa, corrida de inicialização e processos órfãos: runtime Node incluído e testado, caminhos absolutos, IPC de prontidão, porta dinâmica, instância única e encerramento coordenado.
- Migração/perda de histórico: backup SQLite consistente, transação, comparação de registros/vínculos e publicação sem sobrescrita.
