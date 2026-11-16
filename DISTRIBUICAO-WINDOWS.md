# Entrega Windows 1.1.1

## Arquivo destinado ao cliente

**Envie somente `entrega-cliente/MouraAnalytics-Setup-1.1.1.exe`.**

É um instalador completo **NSIS offline**, Windows x64. Não é portable, não é `Moura Analytics.exe` da pasta de aplicação e não é `nsis-web`. O instalador contém o pacote e extrai os arquivos na instalação; o cliente não recebe projeto, ZIP, backend ou `node_modules` separados.

- Tamanho: **137.595.088 bytes** (aproximadamente 131,22 MiB).
- SHA-256: `e6f55e422b2688ae892ef8efd4818064afe3819bf2bac7d493feadf38791f998`.
- Assinatura digital: **sem assinatura**, status `NotSigned` conferido por `Get-AuthenticodeSignature`. O Windows/SmartScreen pode mostrar avisos; não há promessa de ausência deles.

A pasta `entrega-cliente` contém exatamente esse arquivo. `.blockmap`, manifesto, arquivos de build e `win-unpacked` ficam em `release`; não precisam ser enviados. A publicação arquiva instaladores anteriores em `release/entregas-anteriores`, sem misturá-los à entrega atual.

## Conteúdo e preservação

Foi aproveitado o electron-builder/NSIS existente. A versão anterior já era autossuficiente. Nesta etapa foram alterados a versão de distribuição, o nome do artefato, as exclusões de dados pessoais, o comando de entrega e as verificações. **Os 23 arquivos funcionais de Electron/main, backend, frontend e esquema SQL permanecem com hashes iguais aos de antes desta tarefa.** Não houve alteração de interface, estatísticas, dashboard ou geração dos PDFs.

O instalador contém Electron 43.1.0 x64, backend, frontend, dependências de produção, imagens, recursos do PDFKit e o runtime Node 24.15.0 x64. O backend utiliza o Node incluído em `resources/runtime/node.exe`, com o módulo SQLite compatível. O processo principal do Electron não carrega SQLite. O build mantém `npmRebuild: false` de propósito e verifica SQLite/Sharp usando o runtime que será distribuído.

Backend, frontend e dependências estão em `app.asar.unpacked`, pois o processo Node separado precisa acessar arquivos físicos; o runtime executável também fica fora do ASAR. A inicialização usa caminhos relativos à instalação, não caminhos do computador do desenvolvedor nem o cwd do projeto.

Nenhum banco, perfil, senha, foto de cadastro, partida, dado de demonstração, `.env` ou teste foi encontrado no ASAR auditado. Uma pasta de dados nova recebe o esquema vazio pelo inicializador existente. Banco, fotos e segredo local ficam no diretório de dados do usuário, fora da instalação. `appId`, nome do produto, caminhos de dados e estratégia de migração foram preservados. A configuração de atalhos e `deleteAppDataOnUninstall: false` continua ativa.

## Gerar novamente

Em Windows x64, com Node 24 e dependências de desenvolvimento instaladas:

```powershell
npm ci
npm run dist:client
```

Para aumentar a versão de distribuição antes do build:

```powershell
npm version patch --no-git-tag-version
npm run dist:client
```

O primeiro preparo/build pode baixar ferramentas de desenvolvimento e a licença do Node. Esses downloads não são feitos pelo instalador nem pelo aplicativo no computador do cliente.

`npm run dist:win` gera o instalador em `release`. `npm run dist:client` também publica a cópia única em `entrega-cliente` e confere seu hash. O manifesto fica em `release/delivery-manifest.json`.

## Testes efetivamente executados

### Integridade e regressão

- **16 testes Node aprovados**, 0 falhas: API, perfis, fotos, duplas, regras, filtros, migração, prontidão, porta e encerramento.
- **6 PDFs / 18 páginas**: estatísticas, texto, números, páginas e imagens renderizadas iguais às referências originais.
- Auditoria do pacote: 23 arquivos funcionais iguais aos fontes preservados; nenhum arquivo pessoal/proibido; hash do runtime incluído igual ao preparado.
- A pasta de entrega foi conferida: somente o `.exe` final, com hash igual ao arquivo de build.

### Cópia somente do instalador e execução isolada do conteúdo

`node tests/distribution.cjs` terminou com código 0. O teste:

1. Criou uma pasta temporária com **somente uma cópia do instalador final**, sem copiar projeto, dependências ou backend separados para ela.
2. Extraiu desse único arquivo o conteúdo embarcado, usando o 7-Zip do empacotador como ferramenta de inspeção de teste.
3. Executou o aplicativo nativo Windows dessa extração, com cwd temporário, caminho contendo espaços/acentos, perfil Electron isolado e PATH contendo apenas System32.
4. Conferiu o processo Node pelo caminho dentro da própria extração.
5. Usou uma pasta de dados nova, criou perfil, dois atletas com foto/clube e uma dupla; iniciou, registrou eventos e finalizou uma partida.
6. Abriu dashboard e filtros combinados; conferiu valores esperados, incluindo eficiência negativa; concluiu os três downloads PDF.
7. Fechou/reabriu, conferindo perfil, clube, fotos, dupla, link, partida e eventos. Verificou encerramento do backend, liberação de porta e segunda instância.
8. Bloqueou requisições externas no contexto do navegador de teste; os fluxos essenciais não fizeram requisições externas.
9. Importou banco legado fictício com o runtime extraído e gerou seus três PDFs.
10. Repetiu o fluxo com o conteúdo da versão 1.1.0, abriu os mesmos dados com 1.1.1 e comparou registros/vínculos e hashes das fotos: preservados.

Evidências em `test-results/distribution/results.json`, `signature.json`, logs de extração e caminhos das capturas/PDFs registrados no resultado. `test-results/package-audit.json` e `test-results/pdf/comparison.json` complementam a auditoria. Os testes usam apenas bancos fictícios e não alteram o banco pessoal do usuário.

### Limites: não confundir com instalação completa em máquina limpa

O teste acima comprova o conteúdo embarcado e seu funcionamento a partir do `.exe`; **não equivale a executar o assistente NSIS em uma VM limpa**.

- Este host tem Node instalado. O PATH foi isolado e o runtime usado foi conferido, mas não houve teste em Windows sem Node instalado.
- A rede global do Windows não foi desligada. As requisições externas do aplicativo foram bloqueadas no contexto de teste.
- O projeto permaneceu intacto e existente. Não houve bloqueio de acesso à pasta original pelo sistema operacional.
- O NSIS final não foi usado para instalar, atualizar ou desinstalar no perfil atual. O NSIS pode remover a versão registrada com o mesmo identificador; executar isso aqui poderia substituir a instalação pessoal do usuário.
- A preservação de dados na troca **do conteúdo 1.1.0 → 1.1.1** foi testada; a atualização pelo assistente NSIS continua pendente.
- Atalhos e preservação de dados na desinstalação estão configurados. Sua criação/remoção pelo novo assistente ainda requer validação em ambiente Windows de teste.

Não foram encontrados Windows Sandbox, VirtualBox ou VMware disponíveis para realizar esses testes com isolamento completo. Permanece pendente executar o roteiro de instalação offline, atalhos, atualização e desinstalação em VM/usuário Windows de teste sem Node e sem acesso ao projeto.

Para repetir as verificações seguras neste host:

```powershell
npm test
npm run test:pdf
npm run test:distribution
node tests/package-audit.cjs
```

`test:distribution` usa o instalador final e o instalador anterior preservado em `release` para o ensaio entre versões. O teste direto `test:installed` agora recusa substituir uma instalação registrada fora da pasta própria de teste; use-o somente na VM/usuário de teste apropriado.
