# Acerto Samba Nigth — PWA (versão corrigida)

Aplicativo mobile-first para conferir devoluções e calcular o valor a pagar ao fornecedor.

## Recursos
- Produtos reais importados da planilha `custos do samba.xlsx`.
- Cadastro, edição e ativação/desativação de produtos.
- Quantidade devolvida com cálculo automático em centavos.
- Finalização com registro histórico imutável dos preços e quantidades usados.
- Exportação do resumo de um acerto em CSV.
- Exportação e restauração de backup JSON.
- Persistência local em IndexedDB e shell offline via Service Worker.
- HTML, CSS e JavaScript puros, sem frameworks.

## Arquivos
- `index.html`: telas e estrutura
- `visual.css`: interface responsiva
- `app.js`: interface e regras de negócio
- `db.js`: persistência IndexedDB
- `manifest.json`: instalação PWA
- `sw.js`: cache offline
- `icons/`: ícones do aplicativo

## Como testar
1. Extraia o ZIP.
2. Abra a pasta no VS Code.
3. Use a extensão Live Server ou outro servidor HTTP local.
4. Acesse o endereço local fornecido pelo servidor.
5. Confira os produtos, teste quantidades devolvidas, edite um produto e finalize um acerto.
6. No Chrome/Edge, use a opção de instalar o aplicativo quando disponível.

Não abra `index.html` diretamente via `file://`: Service Worker e recursos PWA precisam de HTTPS ou localhost.

## Publicar no GitHub Pages
1. Envie os arquivos e a pasta `icons` para a raiz do repositório.
2. Em Settings → Pages, habilite a publicação pela branch principal e pasta raiz.
3. Acesse a URL HTTPS publicada.
4. Instale pelo navegador.

## Persistência e backup
Os dados ficam no IndexedDB do navegador/dispositivo. Desinstalar o PWA, limpar os dados do navegador ou trocar de dispositivo pode remover os registros. Exporte o backup JSON regularmente e guarde-o fora do aplicativo. A sincronização entre dispositivos não está implementada nesta versão.

## Regra financeira
Valor a pagar por item = (quantidade recebida − quantidade devolvida) × valor unitário.

Valores monetários são armazenados em centavos inteiros. Produtos editados depois de um acerto não alteram o registro histórico finalizado.


## Correções da versão 2
- Corrigida a digitação da quantidade devolvida: o campo não é recriado a cada tecla, preservando o cursor.
- Todos os produtos ativos, incluindo **Whisky — doses**, têm campo de quantidade devolvida.
- Paleta redesenhada com fundo claro, cartões brancos e contraste mais legível.
- Cache do Service Worker versionado para forçar atualização do app.
