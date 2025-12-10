# PortifolioMaker

App de criação de portfólios e apresentações de slides com Angular + TypeScript.

## 🚀 Como iniciar

### Instalar dependências

```bash
npm install
```

### Iniciar servidor de desenvolvimento

```bash
ng serve
```

O servidor será iniciado em `http://localhost:4200`

### Build para produção

```bash
ng build
```

### Executar testes

```bash
ng test
```

## 🛠️ Tecnologias

- Angular 19+
- TypeScript
- Supabase (autenticação e banco de dados)
- Google Drive API
- IndexedDB (armazenamento local)
- jsPDF + html2canvas (exportação PDF)

## 📁 Estrutura

```
src/
├── app/
│   ├── components/
│   │   ├── editor/           # Container principal do editor
│   │   ├── toolbar/          # Barra de ferramentas superior
│   │   ├── sidebar/          # Painel lateral de propriedades
│   │   ├── slide-canvas/     # Área de edição do slide
│   │   ├── slide-list/       # Lista de miniaturas dos slides
│   │   ├── slides/           # Componente de slides (legado)
│   │   ├── photo-import/     # Importação inteligente de fotos
│   │   ├── presentation/     # Modo apresentação fullscreen
│   │   └── project-manager/  # Gerenciador de projetos (salvar/carregar)
│   │
│   ├── services/
│   │   ├── slide.service.ts          # Gerenciamento de slides e elementos
│   │   ├── supabase.service.ts       # Autenticação e sync na nuvem
│   │   ├── google-photos.service.ts  # Integração Google Drive
│   │   ├── project-storage.service.ts # Armazenamento local (IndexedDB)
│   │   ├── project-state.service.ts  # Estado do projeto e auto-save
│   │   └── security.service.ts       # Criptografia e proteção de dados
│   │
│   ├── models/
│   │   ├── slide.model.ts     # Tipos de slides e elementos
│   │   ├── project.model.ts   # Tipos de projeto
│   │   └── layouts.data.ts    # Templates de layouts
│   │
│   ├── app.ts            # Componente principal
│   ├── app.html          # Template principal
│   ├── app.css           # Estilos do componente principal
│   ├── app.routes.ts     # Rotas da aplicação
│   └── app.config.ts     # Configuração do Angular
│
├── environments/
│   ├── environment.ts      # Variáveis de ambiente (dev)
│   └── environment.prod.ts # Variáveis de ambiente (prod)
│
├── styles.css           # Estilos globais
└── index.html           # HTML principal
```

## ✨ Funcionalidades

- ✅ Criação e edição de slides
- ✅ Importação inteligente de fotos (local e Google Drive)
- ✅ Layouts automáticos com guias de posicionamento
- ✅ Modo apresentação fullscreen
- ✅ Exportação para PDF
- ✅ Salvamento local (IndexedDB) e na nuvem (Supabase)
- ✅ Auto-save automático
- ✅ Autenticação com Google e Email
- ✅ Criptografia de dados sensíveis
