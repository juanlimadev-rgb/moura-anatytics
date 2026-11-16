# Moura Analytics 1.1.1

Evolução do aplicativo existente em JavaScript, HTML/CSS, Express, Electron, SQLite e PDFKit. O banco pessoal em `Backend/database/moura.db` não foi usado nos testes, migrado nem incluído na distribuição.

## Cliente Windows

1. Execute `entrega-cliente/MouraAnalytics-Setup-1.1.1.exe` e escolha o destino.
2. Abra **Moura Analytics** pelo atalho na área de trabalho ou menu Iniciar.
3. Na primeira abertura, escolha criar um perfil local ou importar o banco anterior.
4. Cadastre seu perfil e entre. Node, terminal e configuração de banco não são necessários no computador do cliente.

Os recursos essenciais funcionam localmente. O link externo do jogo pode exigir internet. Os dados ficam no diretório de usuário do Electron (`app.getPath('userData')`); use **Arquivo → Pasta de dados** para localizar a pasta exata. Ela contém `moura.db`, `photos/`, `backups/` e `local-secret`. Atualizar a instalação preserva essa pasta; o desinstalador também está configurado para mantê-la. Faça backup da pasta completa com o aplicativo fechado para incluir as fotos.

## Uso

- **Atletas**: adicionar, pesquisar, editar e arquivar; apenas nome é obrigatório. País, altura, idade e anotação antiga de dupla continuam opcionais. Pessoas com o mesmo nome têm IDs diferentes.
- **Fotos**: prévia antes de salvar; PNG/JPEG/WebP até 3 MB e 20 milhões de pixels. O backend decodifica, aplica orientação, reduz para até 640 × 640 sem deformar e grava WebP com nome UUID. Acesso autenticado, sem pasta pública de uploads.
- **Duplas**: selecionar dois atletas ativos do próprio perfil. A ordem dos IDs não duplica uma formação. Reutilizar a formação arquivada a reativa; um atleta pode participar de várias formações.
- **Partida**: selecionar a dupla e inverter as posições 1/2 se necessário. Os cadastros abrem em diálogo e preservam o formulário. O preenchimento manual antigo permanece disponível. O link HTTP/HTTPS é opcional.
- Durante a coleta, os vínculos e nomes daquela partida ficam fixos. Os eventos continuam usando posições 1/2. Editar o cadastro posteriormente não altera os nomes históricos nem os PDFs.
- **Histórico → Analisar**: uma página com seleção dupla/atleta e partida/set. Os cartões, tabelas, distribuições e métricas acompanham a mesma seleção. Os placares no cabeçalho são os da partida, identificados como tal.
- Cada categoria usa como denominador os registros do respectivo fundamento na seleção. Não some fundamentos para obter pontos. Sem registros, a interface informa ausência de dados. Saque e bloqueio continuam sem aproveitamento/eficiência.
- Os três botões PDF são sempre da **partida inteira**, independentemente do set visual selecionado.

## Desenvolvimento

Windows x64, Node **24.x** (distribuição verificada com 24.15.0), npm. O cliente final não precisa desses programas.

```powershell
cd D:\Downloads\MouraAnalytics-FINAL\MouraAnalytics-LOCAL
npm ci
npm start
```

`npm start` prepara um runtime local em `runtime/` e abre o Electron. A primeira preparação obtém a licença oficial do Node; gerar a distribuição pode baixar ferramentas de build. Esses acessos são apenas de desenvolvimento. `iniciar.bat` é um facilitador de desenvolvimento; não é o instalador do cliente.

Para executar somente o backend e abrir `http://127.0.0.1:3000/login.html`:

```powershell
npm run start:backend
```

`MOURA_DATA_DIR` permite um diretório separado de dados para desenvolvimento/testes. Não aponte testes para o banco pessoal.

## Testes

```powershell
npm test
npm run test:ui
npm run test:pdf
npm run test:packaged
node tests/install-and-verify.cjs
```

- `npm test`: Node Test Runner, bancos temporários fictícios, API HTTP local, regras, propriedade, fotos, migrações e ciclo de vida.
- `test:ui`: cenário completo no Edge headless via Playwright; requer Edge instalado. Capturas e PDFs em `test-results/ui/`.
- `test:pdf`: compara seis PDFs com as referências originais, inclusive após migração: estatísticas, texto, páginas e PNGs renderizados. Requer Python com `pypdf` e Poppler (`pdfinfo`, `pdftoppm`). Configure `PDF_PYTHON` e `POPPLER_BIN` se necessário. O script também reconhece o runtime de ferramentas deste ambiente. Resultados em `test-results/pdf/`.
- `test:packaged`: verifica `release/win-unpacked/Moura Analytics.exe`, com PATH restrito a System32, dados fictícios e checagem do processo Node incluído. Pode usar `MOURA_INSTALLED_EXE` para escolher outro executável.
- `install-and-verify`: instala silenciosamente o NSIS em `test-results/Windows instalado São Luís/` e executa a verificação do aplicativo instalado. Cria os atalhos/registro de instalação do produto. Use um ambiente de teste; não é uma simulação de instalação.

As referências em `tests/reference/` foram capturadas antes de alterar o servidor. A data de emissão está fixada apenas no ambiente de comparação. O capturador verifica o hash original e recusa substituir as referências com código modificado.

## Gerar o instalador

```powershell
npm ci
npm run pack:win
npm run dist:client
```

Saída: `entrega-cliente/MouraAnalytics-Setup-1.1.1.exe` (Windows x64, NSIS). `pack:win` gera a pasta executável sem instalar. O build usa dependências de produção na raiz, com versões do backend preservadas, e exclui banco, `.env`, executável antigo, testes e dados de desenvolvimento.

O SQLite desta versão não foi recompilado para a ABI do Electron: o backend usa **Node 24 incluído no instalador**. `scripts/prepare-runtime.cjs` verifica SQLite e Sharp com o próprio executável copiado antes de empacotar. `npmRebuild: false` é intencional: recompilar essas dependências para Electron quebraria o runtime separado do backend. O processo principal do Electron não carrega SQLite; até a importação usa o runtime incluído.

Backend, frontend e módulos são extraídos para `app.asar.unpacked`, pois o Node separado precisa ler arquivos físicos. O Electron usa porta dinâmica em loopback, espera mensagem IPC de prontidão, impede segunda instância e encerra o backend ao fechar. Falhas de inicialização abrem mensagem em português e não apagam os dados.

Dependências novas: **Sharp** para validação/decodificação real das fotos; **electron-builder** para NSIS/runtime; **Playwright**, somente desenvolvimento, para os fluxos verificáveis. Não houve atualização geral das dependências existentes. O instalador desta entrega não tem certificado de assinatura de código.

## Importação e migração

A escolha **Importar banco antigo** aparece antes de criar o primeiro banco de destino. Se o destino existir, ele será usado, nunca substituído silenciosamente. Não há mescla automática de duas bases.

1. Feche a versão anterior antes de importar; guarde uma cópia do banco original.
2. Selecione seu `moura.db` antigo no primeiro início da nova versão.
3. A API SQLite de backup cria uma cópia consistente, incluindo transações confirmadas em WAL; o arquivo original é aberto somente para leitura.
4. A cópia recebe backup pré-migração em `backups/`. A migração v2 ocorre em transação.
5. Validação compara contagens e SHA-256 de todos os campos originais, ordenados por ID, incluindo vínculos de usuário, partida, posição e set. Também executa `integrity_check`.
6. O destino só é publicado ao final, por operação que falha se ele já existir. Erros removem a cópia em preparação, mantendo original e backup.
7. Reabrir um banco v2 não reaplica nem duplica a migração. Uma versão de esquema mais nova é recusada.

Atletas legados sem proprietário permanecem sem dono e não são exibidos a nenhum perfil. Não se vincula uma partida antiga a um cadastro por semelhança de nome. As partidas antigas continuam acessíveis por seus nomes salvos, sem exigir foto/clube/dupla cadastrada.

Para uma importação técnica explícita, sempre com destino inexistente:

```powershell
node Backend/import-cli.js "D:\copia antiga\moura.db" "D:\destino novo\moura.db"
```

Veja `INSPECAO.md` para o comportamento original e `VALIDACAO.md` para evidências, resultados e limitações desta entrega.

A validação específica da entrega 1.1.1 e suas limitações estão em `DISTRIBUICAO-WINDOWS.md`. Envie ao cliente somente o executável de `entrega-cliente`.


## Revisão para publicação — 16/11/2026

A aplicação atual é **local**, com JavaScript, Express, SQLite e Electron. Instale e execute os comandos **na raiz**, não em `Backend/`. O frontend atual está em `Frontend/` e é servido pelo backend local. O diretório `docs/` mantido no histórico do repositório pertence à antiga versão web; não é o frontend desta versão. GitHub Pages não executa este backend nem substitui a instalação local.

O código não inclui bancos pessoais, fotos de atletas, segredos locais, instaladores ou dependências. Ao executar, os dados são criados no diretório do usuário. Para testes isolados, use `MOURA_DATA_DIR` apontando para uma pasta de teste vazia.

Não há credenciais padrão nem chave JWT fixa. Um script antigo de importação MySQL com credencial embutida foi retirado da versão atual. A credencial antiga deve ser revogada no provedor; remover o arquivo não apaga commits anteriores.

Esta revisão confirma o funcionamento do backend e da interface local. Não foi gerado nem instalado um novo instalador Windows. Os relatórios anteriores de distribuição são registros históricos e não validam um pacote novo.

Consulte `REVISAO-PUBLICACAO.md` para os testes efetivamente executados nesta revisão.
