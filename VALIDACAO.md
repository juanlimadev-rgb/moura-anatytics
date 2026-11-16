> Registro da etapa anterior (1.1.0). Para a entrega atual 1.1.1, consulte DISTRIBUICAO-WINDOWS.md.

# Verificações executadas em 31/10/2026

## Implementado

Atletas por perfil (nome, clube, foto e campos legados opcionais), busca, edição e arquivamento; duplas por IDs, reutilização independente da ordem e arquivamento; seleção de posições na partida, cadastro sem perder formulário e link HTTP/HTTPS; dashboard único com filtros combinados; distribuição de categorias e métricas originais; três PDFs completos; ajustes visuais; migração v2 com backup; instalador Windows x64 com Electron, Node, SQLite e dependências incluídos.

## Testes automatizados

`node --test tests/*.test.cjs`: **16 testes aprovados, 0 falhas** na última execução.

Incluem autenticação de dois perfis, acesso sem token, tentativa de IDs cruzados em consulta/foto/edição/arquivamento/dupla/partida/dashboard/PDF/evento/desfazer/finalização, proprietário obtido pelo JWT, pessoas homônimas, fotos válidas e inválidas, extensão/conteúdo incompatível, arquivo acima do limite, imagem acima de 20 milhões de pixels, remoção/substituição de foto, campos legados, atleta arquivado, dupla invertida, formação reutilizada, posições invertidas, URL inválida, idempotência, partida vazia, somente um atleta com eventos, dois atletas/sets, categorias zero, filtros combinados, eficiência negativa, fórmulas de todos os fundamentos, arredondamentos, desfazer, finalização transacional, bloqueio após finalizar e persistência.

Migração: banco v1 fictício com WAL, 55 eventos, dois registros de partidas, três sets e atleta sem proprietário. Backup consistente, igualdade das contagens e campos/vínculos originais, `integrity_check`, não atribuição de dono arbitrário, reexecução sem duplicar, recusa de destino existente, rejeição de arquivo inválido e rollback diante de esquema incompatível. Ciclo de vida: mensagem de prontidão, porta dinâmica, conflito `EADDRINUSE`, encerramento e liberação da porta.

## Interface e visual

`node tests/ui.cjs`: cenário completo no Edge headless, **sem erros JavaScript**. Perfil A criado pela tela; dois atletas com clube/foto e prévia; pesquisa; dupla e reutilização invertida; dois sentidos da troca de posições; formulário preservado; partida com vídeo; eventos dos dois atletas em mais de um set; desfazer; clique duplicado; finalização; histórico; dashboard; dupla/atletas; set/inteira; dados vazios; valores esperados independentes; três downloads; backend fechado/reaberto com fotos e dados persistidos; perfil B vazio e tentativa direta de partida A com resposta 404.

Foi forçado atraso de respostas e retirado o sinal de abort somente no teste para comprovar que a versão antiga também é ignorada pelo contador. Foi atrasada a gravação de eventos para comprovar que a fila mantém o set capturado no clique, mesmo que o seletor seja alterado antes do envio.

Capturas inspecionadas de cadastro, formulário e dashboard; dashboard em **1440, 1100 e 900 pixels**, com verificação automatizada de ausência de rolagem horizontal. A janela nativa instalada também foi inspecionada via Computer Use, incluindo cadastro vazio e partida antiga filtrada em Ana / Set 1, avatar padrão e eficiência −50%. Sem janela de erro nessa conferência final.

Evidências: `test-results/ui/results.json`, `test-results/ui/*.png` e `test-results/packaged/dashboard-installed.png`.

## PDFs

`node tests/compare-pdfs.cjs`: **6 de 6 iguais às referências originais**, três tipos × partida com eventos/partida vazia. A execução atual usa a base de referência após migração v2.

- Estatísticas e categorias iguais.
- Texto e números extraídos com pypdf iguais.
- **3 páginas por PDF**, 18 páginas comparadas no total.
- Todas as páginas renderizadas com Poppler, a 1000 pixels, têm PNGs com hashes idênticos antes/depois.
- Saque/bloqueio mantêm NULL nas métricas não aplicáveis; as demais fórmulas e arredondamentos foram preservados.

Evidências: originais em `tests/reference/`, `test-results/pdf/comparison.json`, PDFs e PNGs de comparação em `test-results/pdf/`. Também foram concluídos os três downloads atuais e os três downloads de partida antiga no aplicativo instalado.

O teste inicial de download no Electron continha um `require` indevido em callback do contexto de avaliação do Playwright, causando a caixa de erro observada durante o trabalho. O teste foi corrigido e repetido. A URL Blob também passou a permanecer válida por 60 segundos, evitando invalidá-la antes de o gerenciador nativo iniciar o download. O conteúdo dos PDFs não mudou.

## Windows instalado

Instalador NSIS gerado: `release/Moura-Analytics-1.1.0-Setup.exe`.

Instalação real executada em `test-results/Windows instalado São Luís/`, exercitando caminho com espaços e acentos. Foram verificados:

- Electron em modo empacotado.
- PATH contendo apenas System32; processo filho Node conferido pelo caminho **dentro da instalação**, sem utilizar Node do PATH.
- SQLite nativo funcionando e Sharp gravando/carregando fotos.
- Perfil local, dois atletas com fotos e clube, dupla, link, eventos dos dois atletas em dois sets, filtros, resultado e três PDFs com download nativo `completed`.
- Números da seleção individual conferidos, incluindo eficiência −100%.
- Segunda instância encerrada sem conflito.
- Fechar a janela encerra o backend e libera a porta.
- Reabrir preserva perfil, clube, fotos, dupla, vídeo, partida e eventos.
- Importação de uma cópia de banco v1 pelo runtime e código instalados; histórico antigo, 10 ataques / eficiência −40% da dupla e três PDFs antigos concluídos.
- Atalhos na área de trabalho e menu Iniciar existem e apontam para o executável instalado.
- Abertura real pelo atalho da área de trabalho, com PATH isolado e sem instrumentação: tela de login conferida via Computer Use e janela encerrada com Alt+F4.

Evidências: `test-results/packaged/results.json`, `processes.json`, PDFs baixados em suas subpastas `downloads-*`, `test-results/shortcuts.json`. O comando de instalação/verificação encerrou com código 0 após a inspeção visual.

`node tests/package-audit.cjs`: **23 arquivos de produção correspondem aos fontes finais**; nenhum banco, `.env`, `.git`, dado de teste ou executável de backend antigo no ASAR. Runtime incluído tem o mesmo SHA-256 do runtime preparado. Evidência: `test-results/package-audit.json`.

O banco pessoal foi consultado novamente somente para leitura ao final: permanece com 2 usuários, 6 partidas, 378 eventos, 15 sets e 0 atletas, iguais às contagens iniciais. Nenhum teste usou esse arquivo como destino.

## Limitações e verificações pendentes

1. **Windows limpo sem Node instalado não foi testado.** Este host tem Node. PATH isolado, runtime incluído e caminho real do processo foram verificados; isso não substitui uma instalação em VM/máquina limpa.
2. **Atualização entre duas versões diferentes do produto não foi testada.** O instalador foi instalado novamente no mesmo destino durante as verificações; o banco fica fora da instalação e a configuração preserva os dados, mas falta uma prova de atualização entre releases distintas em ambiente de cliente.
3. O instalador não tem certificado de assinatura de código (`NotSigned` conferido). O ícone do instalador continua sendo o padrão do Electron; a marca existente foi preservada na interface.
4. A escolha inicial de importar e o seletor nativo de arquivo não foram percorridos de ponta a ponta pela UI. O comando de importação usado por esse fluxo foi executado com o runtime instalado e bancos fictícios, com backup e validação completos.
5. O link HTTP/HTTPS foi validado, persistido e exibido; a abertura de um vídeo real no navegador padrão não foi exercitada. Não há incorporação nem download de vídeo.
6. Comportamentos herdados dos PDFs foram preservados: a data ISO sem horário pode aparecer no dia anterior por causa do fuso usado originalmente; a tabela consolidada excede a largura útil do A4. A comparação comprova equivalência, não uma correção desses aspectos originais. Detalhes em `INSPECAO.md`.
7. O npm reporta alertas nas dependências existentes/transitivas. Não foi executado `audit fix` nem uma atualização geral fora do escopo. Isso não foi tratado como uma validação de segurança completa.

## Arquivos principais

- `main.js`, `package.json`, `package-lock.json`, `scripts/prepare-runtime.cjs`: inicialização e distribuição.
- `Backend/server.js`: consulta compartilhada preservada, filtro opcional por set, integração e ciclo de vida.
- `Backend/management.js`: cadastros, fotos, vínculos, dashboard e mutações com propriedade/idempotência.
- `Backend/paths.js`, `Backend/database/{connection,init,migrate,import-legacy}.js`, `schema-v1.sql`, `Backend/import-cli.js`: dados por usuário e migração.
- `Frontend/index.html`, `script.js`, `common.js`, `roster.js`, `dashboard.js`, `enhancements.css`, login/cadastro: interface e preservação dos fluxos.
- `tests/`: exemplos fictícios, referências originais e verificações reproduzíveis.
- `README.md`, `INSPECAO.md`, `leiame.txt`: execução, instalação, escopo e decisões.
