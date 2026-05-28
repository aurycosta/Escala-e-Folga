# Escala de Folgas (HTML / WAP)

## Como usar
1) Extraia o ZIP.
2) Abra `index.html` no navegador.

### Importar lista de colaboradores
- Clique em **Importar CSV** e selecione seu arquivo.
- O CSV pode usar `;` (ponto e vírgula) ou `,` (vírgula).
- Colunas esperadas (nomes podem variar):
  - `matricula`
  - `Nome` (ou `nome`)

### Configurar folga fixa
- Clique em um colaborador na lista (ou no botão **Editar** na linha dele).
- Marque os dias de folga fixa (ex.: **Sáb**).

### Ajustes por data (override)
- No calendário, clique em um dia:
  - Se o dia seria **trabalho**, vira **folga extra**
  - Se o dia seria **folga**, vira **trabalho (override)**
  - Se já for extra/override, remove
- Ou use o modal para adicionar/remover por data.

### Gerar PDF (para mural)
- Clique em **Gerar PDF (Imprimir)** e escolha **Salvar como PDF**.
- Dica: em “Mais configurações” ative **Paisagem** se quiser caber mais fácil.

## Observações
- Os dados ficam salvos no seu navegador (LocalStorage), então você pode fechar e abrir que mantém.
- Botão **Reset local** apaga somente os dados deste navegador.

Boa! ✅
