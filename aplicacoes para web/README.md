# Novo Projeto

Base estática adaptada a partir do HTML original, pronta para ser personalizada.

## Arquivos

- `index.html`: estrutura da página, metadados e conteúdo.
- `assets/styles.css`: tema, layout responsivo e componentes visuais.
- `assets/app.js`: alternância de tema com persistência no navegador.

## Como abrir

Abra `index.html` no navegador.

Se preferir servir por HTTP local:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Depois acesse `http://127.0.0.1:4173/`.

## O que foi removido do HTML original

- Scripts de tracking e pixels.
- Dependências específicas de plataforma.
- Bundles gerados que não existem neste projeto.
- Manifestos, favicons e assets externos específicos da marca anterior.
