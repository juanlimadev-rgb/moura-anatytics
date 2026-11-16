# Revisão de publicação — 16/11/2026

Arquitetura preservada: JavaScript, HTML/CSS, Express, SQLite e Electron. Nenhuma fórmula esportiva, consulta compartilhada de estatísticas ou layout PDF foi alterado.

## Verificações executadas

- Instalação limpa: `npm ci --omit=dev --no-audit --no-fund` — concluída, 153 pacotes.
- `node --test tests/*.test.cjs` — **16 testes aprovados**, inclusive com as dependências da instalação limpa.
- `node tests/compare-pdfs.cjs` — **6 PDFs comparados**, 3 páginas cada: estatísticas, texto, paginação e pixels idênticos às referências fictícias.
- `node tests/ui.cjs` — fluxo aprovado no Edge: dois perfis, atletas com fotos, busca, duplas, posições, marcação, desfazer, idempotência, finalização, filtros combinados, três downloads PDF, reinício do backend, persistência e isolamento entre usuários.
- Interface verificada pelo teste nas larguras 1440, 1100 e 900, sem rolagem horizontal e sem erros JavaScript.

A comparação PDF usa Python com pypdf e Poppler, informados por `PDF_PYTHON` e `POPPLER_BIN`. O teste visual utilizou Playwright já disponível no ambiente de desenvolvimento. A instalação limpa de produção foi validada separadamente, sem copiar `node_modules` para o repositório.

## Ajustes desta revisão

- O teste PDF agora envia `Connection: close`: a renderização síncrona entre requisições expirava conexões keep-alive e causava `ECONNRESET`. Após a correção, os seis relatórios passaram sem mudança no código de geração.
- Documentação atualizada para indicar execução na raiz e frontend atual em `Frontend/`.
- Exclusão de arquivos de dados, segredos, fotos, backups e executáveis no versionamento.
- Dockerfile antigo do backend retirado: ele descrevia uma execução remota diferente da arquitetura local atual.
- Script legado de importação MySQL com credencial fixa retirado da versão atual do repositório. A revogação da credencial no provedor continua necessária porque os commits antigos são preservados.

## Limites

Esta revisão não gerou, instalou nem validou um novo instalador Electron/NSIS. Não se reivindica validação em outro sistema operacional. Os relatórios anteriores de instalador são históricos. Dados pessoais reais e bancos originais não foram usados nos testes nem enviados ao GitHub. Os arquivos `docs/` da versão web antiga foram preservados sem alteração; a versão local atual usa `Frontend/`.
