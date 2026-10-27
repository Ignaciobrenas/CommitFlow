export type Language = 'auto' | 'es' | 'en';

export const LOCALES: Record<'es' | 'en', Record<string, string>> = {
  es: {
    // Header & Toolbar
    'app.name': 'CommitFlow',
    'toolbar.searchPlaceholder': 'Buscar commits, autores, hashes...',
    'toolbar.allBranches': 'Todas las ramas',
    'toolbar.checkout': 'Cambiar a rama seleccionada',
    'toolbar.myImpact': 'Mi Impacto',
    'toolbar.settings': 'Ajustes de CommitFlow',
    'toolbar.refresh': 'Refrescar grafo',
    'toolbar.activeBranch': 'Rama activa actual',
    'toolbar.stash': 'Gestor de Git Stash',
    'toolbar.openFullPanel': 'Abrir en pestaña completa de editor',
    'toolbar.moreActions': 'Más opciones',
    'toolbar.searchClear': 'Limpiar búsqueda',

    // Stats Bar
    'stats.commits': 'Commits:',
    'stats.contributors': 'Colaboradores:',
    'stats.branches': 'Ramas:',
    'stats.stashes': 'Stashes:',
    'stats.stashesTooltip': 'Stashes guardados (clic para abrir gestor)',
    'stats.commitsTooltip': 'Total de commits en el repositorio',
    'stats.contributorsTooltip': 'Colaboradores del repositorio',
    'stats.branchesTooltip': 'Ramas locales y remotas',
    'stats.you': 'Tú:',
    'stats.clickToFilter': 'Haz clic para filtrar por este colaborador',
    'stats.clickToViewAnalytics': 'Haz clic para ver tus estadísticas personales de ramas y commits',

    // Graph States
    'graph.emptyRepo': 'Repositorio vacío',
    'graph.emptyRepoDesc': 'Aún no hay commits en este repositorio. Realiza un commit para visualizar el historial.',
    'graph.noMatchingCommits': 'No se encontraron commits',
    'graph.noMatchingDesc': 'Intenta buscar con otro mensaje de commit, nombre de autor o hash.',
    'graph.loading': 'Cargando historial de ramas y commits...',
    'graph.failedToLoad': 'Error al cargar el historial de Git',

    // Row Quick Actions
    'action.copySha': 'Copiar SHA',
    'action.copyMsg': 'Copiar mensaje de commit',
    'action.viewDiff': 'Ver cambios con revisión anterior',
    'action.viewOnGitHub': 'Abrir en GitHub / remoto',
    'action.checkout': 'Hacer checkout a este commit',
    'action.inspect': 'Inspeccionar detalles y archivos',

    // Commit Drawer
    'drawer.title': 'Detalles del Commit y Archivos',
    'drawer.copySha': 'Copiar SHA',
    'drawer.copyMsg': 'Copiar Mensaje',
    'drawer.viewOnGitHub': 'Ver en GitHub',
    'drawer.commitMessage': 'Mensaje del Commit',
    'drawer.changedFiles': 'Archivos Modificados',
    'drawer.fetchingFiles': 'Obteniendo lista de archivos modificados...',
    'drawer.noFiles': 'No se modificaron archivos en este commit.',
    'drawer.parents': 'Commits Padres',
    'drawer.initialCommit': 'Commit Inicial (Raíz)',
    'drawer.diffHint': 'Diff',
    'drawer.openFile': 'Abrir archivo en el editor',
    'drawer.copyPath': 'Copiar ruta del archivo',

    // Settings Modal
    'settings.title': 'Ajustes de CommitFlow',
    'settings.tabAppearance': 'Apariencia',
    'settings.tabGraph': 'Grafo y Ramas',
    'settings.tabBlame': 'Live Blame',
    'settings.tabSync': 'Alertas y Sync',
    'settings.densityLabel': 'Densidad de Filas',
    'settings.densityDesc': 'Ajusta el alto de cada commit en la tabla para adaptarse al IDE.',
    'settings.densityCompact': 'Compacto (22px - Alta Densidad)',
    'settings.densityComfortable': 'Cómodo (26px - Predeterminado VS Code)',
    'settings.densitySpacious': 'Espacioso (32px - Holgado)',
    'settings.themeLabel': 'Tema de Color',
    'settings.themeDesc': 'Elige el esquema de color o sigue automáticamente el tema del IDE.',
    'settings.themeAuto': 'Automático (según tema de VS Code)',
    'settings.themeDark': 'Modo Oscuro Cyber',
    'settings.themeLight': 'Modo Claro Profesional',
    'settings.animationsLabel': 'Animaciones y Efectos',
    'settings.animationsDesc': 'Activa transiciones suaves de ramas, baliza pulsante y efectos hover.',
    'settings.languageLabel': 'Idioma de la Interfaz',
    'settings.languageDesc': 'Selecciona el idioma de CommitFlow o sigue el de VS Code.',
    'settings.langAuto': 'Automático (idioma de VS Code)',
    'settings.langEs': 'Español (Predeterminado)',
    'settings.langEn': 'English',
    'settings.pageSizeLabel': 'Límite de Commits',
    'settings.pageSizeDesc': 'Número máximo de commits cargados en el grafo inicial.',
    'settings.inlineBlameLabel': 'Live Inline Blame en Editor',
    'settings.inlineBlameDesc': 'Muestra el autor y fecha al final de la línea activa en el editor.',
    'settings.debounceLabel': 'Retardo de Blame (ms)',
    'settings.debounceDesc': 'Tiempo de espera antes de calcular el autor tras mover el cursor.',
    'settings.avatarServiceLabel': 'Proveedor de Avatares',
    'settings.avatarServiceDesc': 'Servicio para resolver fotos de perfil por correo.',
    'settings.notifyMergesLabel': 'Notificar Merges y Cambios',
    'settings.notifyMergesDesc': 'Avisa cuando se mergea una rama o hay commits en el remoto y pregunta si quieres hacer pull.',
    'settings.autoFetchLabel': 'Auto-Fetch en Segundo Plano',
    'settings.autoFetchDesc': 'Consulta periódicamente cambios del remoto (minutos, 0 desactiva).',
    'settings.saveBtn': 'Guardar Ajustes',
    'settings.savedNotice': '¡Ajustes guardados correctamente!',

    // Personal Impact Modal
    'personal.title': 'Tu Contribución e Impacto Personal',
    'personal.verifiedContributor': 'Colaborador Verificado',
    'personal.yourCommits': 'Tus Commits',
    'personal.totalRepoCommits': 'Total Commits del Repo',
    'personal.branchesInvolved': 'Ramas en las que participas',
    'personal.branchParticipation': 'Tu Participación por Rama',
    'personal.noContributions': 'No se detectaron contribuciones en ramas aún.',
    'personal.filterHint': 'Haz clic para filtrar el grafo por esta rama',

    // Blame Hover in Editor
    'blame.viewChanges': 'Ver Cambios',
    'blame.inspectInGraph': 'Inspeccionar en Grafo',
    'blame.copySha': 'Copiar SHA',
    'blame.openRemote': 'Abrir en Remoto',
    'blame.uncommitted': 'Modificaciones locales sin confirmar en working tree',
    'blame.compareWithHead': 'Comparar Working Tree con HEAD',
    'blame.openGraph': 'Abrir Grafo',
    'blame.line': 'Línea',

    // Branch Watcher & Sync Notifications
    'watcher.mergeDetected': 'CommitFlow: Se ha detectado un merge o nuevos commits en',
    'watcher.commitsBehind': 'commits por detrás del upstream.',
    'watcher.pullPrompt': '¿Cómo deseas sincronizar tu rama?',
    'watcher.pullNow': 'Hacer Pull',
    'watcher.rebaseNow': 'Hacer Rebase',
    'watcher.mergeNow': 'Hacer Merge',
    'watcher.viewInGraph': 'Ver en Grafo',
    'watcher.dismiss': 'Descartar',
    'watcher.pullingProgress': 'CommitFlow: Sincronizando y ejecutando git pull...',
    'watcher.pullSuccess': 'Rama sincronizada con éxito mediante git pull.',
    'watcher.pullError': 'Error al ejecutar git pull:',
    'watcher.rebasingProgress': 'CommitFlow: Ejecutando git rebase...',
    'watcher.rebaseSuccess': 'Rebase completado con éxito.',
    'watcher.rebaseError': 'Error al ejecutar git rebase:',
    'watcher.mergingProgress': 'CommitFlow: Ejecutando git merge...',
    'watcher.mergeSuccess': 'Merge completado con éxito.',
    'watcher.mergeError': 'Error al ejecutar git merge:',

    // Upstream Sync Toolbar
    'sync.upstreamBehind': 'tu rama está por detrás de {upstream}',
    'sync.commitsBehind': '{count} por detrás',
    'sync.commitsAhead': '{count} por delante',
    'sync.rebase': 'Rebase',
    'sync.merge': 'Merge',
    'sync.pull': 'Pull',
    'sync.syncOptions': 'Opciones de sincronización con la rama origen',

    // Git Stash Manager
    'stash.title': 'Gestor de Git Stash',
    'stash.saveBtn': 'Guardar en Stash',
    'stash.inputPlaceholder': 'Mensaje descriptivo opcional para el stash...',
    'stash.empty': 'No hay stashes guardados en este repositorio.',
    'stash.pop': 'Pop',
    'stash.apply': 'Aplicar',
    'stash.drop': 'Descartar',
    'stash.stashes': 'Stashes:',
  },

  en: {
    // Header & Toolbar
    'app.name': 'CommitFlow',
    'toolbar.searchPlaceholder': 'Search commits, authors, hashes...',
    'toolbar.allBranches': 'All Branches',
    'toolbar.checkout': 'Checkout Selected Branch',
    'toolbar.myImpact': 'My Impact',
    'toolbar.settings': 'CommitFlow Settings',
    'toolbar.refresh': 'Refresh Graph',
    'toolbar.activeBranch': 'Current Active Branch',
    'toolbar.stash': 'Git Stash Manager',
    'toolbar.openFullPanel': 'Open in Full Editor Tab',
    'toolbar.moreActions': 'More Options',
    'toolbar.searchClear': 'Clear Search',

    // Stats Bar
    'stats.commits': 'Commits:',
    'stats.contributors': 'Contributors:',
    'stats.branches': 'Branches:',
    'stats.stashes': 'Stashes:',
    'stats.stashesTooltip': 'Saved stashes (click to open manager)',
    'stats.commitsTooltip': 'Total commits in repository',
    'stats.contributorsTooltip': 'Repository contributors',
    'stats.branchesTooltip': 'Local & remote branches',
    'stats.you': 'You:',
    'stats.clickToFilter': 'Click to filter commits by this contributor',
    'stats.clickToViewAnalytics': 'Click to view your personal branch & commit analytics',

    // Graph States
    'graph.emptyRepo': 'Empty Repository',
    'graph.emptyRepoDesc': 'No commits found in this repository yet. Commit files to view your Git history.',
    'graph.noMatchingCommits': 'No matching commits',
    'graph.noMatchingDesc': 'Try searching for a different commit message, author name, or hash.',
    'graph.loading': 'Loading commits and branch history...',
    'graph.failedToLoad': 'Failed to load Git history',

    // Row Quick Actions
    'action.copySha': 'Copy SHA',
    'action.copyMsg': 'Copy commit message',
    'action.viewDiff': 'View changes with previous revision',
    'action.viewOnGitHub': 'Open on GitHub / remote',
    'action.checkout': 'Checkout this commit',
    'action.inspect': 'Inspect details & files',

    // Commit Drawer
    'drawer.title': 'Commit Details & Diffs',
    'drawer.copySha': 'Copy SHA',
    'drawer.copyMsg': 'Copy Message',
    'drawer.viewOnGitHub': 'View on GitHub',
    'drawer.commitMessage': 'Commit Message',
    'drawer.changedFiles': 'Changed Files',
    'drawer.fetchingFiles': 'Fetching modified files list...',
    'drawer.noFiles': 'No files changed in this commit.',
    'drawer.parents': 'Parent Commits',
    'drawer.initialCommit': 'Initial Commit (Root)',
    'drawer.diffHint': 'Diff',
    'drawer.openFile': 'Open file in editor',
    'drawer.copyPath': 'Copy file path',

    // Settings Modal
    'settings.title': 'CommitFlow Settings',
    'settings.tabAppearance': 'Appearance',
    'settings.tabGraph': 'Graph & Branches',
    'settings.tabBlame': 'Live Blame',
    'settings.tabSync': 'Alerts & Sync',
    'settings.densityLabel': 'Row Density',
    'settings.densityDesc': 'Adjust commit row height to match your IDE workspace.',
    'settings.densityCompact': 'Compact (22px - High Density)',
    'settings.densityComfortable': 'Comfortable (26px - VS Code Default)',
    'settings.densitySpacious': 'Spacious (32px - Roomy)',
    'settings.themeLabel': 'Color Theme',
    'settings.themeDesc': 'Choose theme scheme or automatically adapt to your VS Code editor theme.',
    'settings.themeAuto': 'Automatic (VS Code Theme)',
    'settings.themeDark': 'Cyber Dark Mode',
    'settings.themeLight': 'Professional Light Mode',
    'settings.animationsLabel': 'Animations & Motion',
    'settings.animationsDesc': 'Enable smooth branch transitions, pulsing beacons, and hover glow effects.',
    'settings.languageLabel': 'Interface Language',
    'settings.languageDesc': 'Select CommitFlow display language or follow VS Code setting.',
    'settings.langAuto': 'Automatic (VS Code Language)',
    'settings.langEs': 'Español (Spanish)',
    'settings.langEn': 'English',
    'settings.pageSizeLabel': 'Commit Page Limit',
    'settings.pageSizeDesc': 'Maximum number of commits rendered on initial graph load.',
    'settings.inlineBlameLabel': 'Live Inline Blame in Editor',
    'settings.inlineBlameDesc': 'Display author and date at the end of the active line in editor.',
    'settings.debounceLabel': 'Blame Debounce (ms)',
    'settings.debounceDesc': 'Wait time before computing line blame after cursor movement.',
    'settings.avatarServiceLabel': 'Avatar Provider',
    'settings.avatarServiceDesc': 'Service used to resolve author profile pictures by email.',
    'settings.notifyMergesLabel': 'Notify on Merges & Changes',
    'settings.notifyMergesDesc': 'Alert when branch is merged or remote has new commits and prompt for git pull.',
    'settings.autoFetchLabel': 'Background Auto-Fetch',
    'settings.autoFetchDesc': 'Periodically poll remote repository changes (minutes, 0 to disable).',
    'settings.saveBtn': 'Save Settings',
    'settings.savedNotice': 'Settings saved successfully!',

    // Personal Impact Modal
    'personal.title': 'Your Personal Contribution & Impact',
    'personal.verifiedContributor': 'Verified Contributor',
    'personal.yourCommits': 'Your Commits',
    'personal.totalRepoCommits': 'Total Repo Commits',
    'personal.branchesInvolved': 'Branches Involved',
    'personal.branchParticipation': 'Your Participation by Branch',
    'personal.noContributions': 'No branch contributions detected yet.',
    'personal.filterHint': 'Click to filter graph by this branch',

    // Blame Hover in Editor
    'blame.viewChanges': 'View Changes',
    'blame.inspectInGraph': 'Inspect in Graph',
    'blame.copySha': 'Copy SHA',
    'blame.openRemote': 'Open on Remote',
    'blame.uncommitted': 'Uncommitted local modifications in working tree',
    'blame.compareWithHead': 'Compare Working Tree with HEAD',
    'blame.openGraph': 'Open Graph',
    'blame.line': 'Line',

    // Branch Watcher & Sync Notifications
    'watcher.mergeDetected': 'CommitFlow: Merge or new commits detected in',
    'watcher.commitsBehind': 'commits behind upstream.',
    'watcher.pullPrompt': 'How would you like to synchronize your branch?',
    'watcher.pullNow': 'Pull',
    'watcher.rebaseNow': 'Rebase',
    'watcher.mergeNow': 'Merge',
    'watcher.viewInGraph': 'View in Graph',
    'watcher.dismiss': 'Dismiss',
    'watcher.pullingProgress': 'CommitFlow: Running git pull and syncing...',
    'watcher.pullSuccess': 'Branch successfully synchronized via git pull.',
    'watcher.pullError': 'Failed to execute git pull:',
    'watcher.rebasingProgress': 'CommitFlow: Rebasing onto upstream...',
    'watcher.rebaseSuccess': 'Rebase completed successfully.',
    'watcher.rebaseError': 'Failed to execute git rebase:',
    'watcher.mergingProgress': 'CommitFlow: Merging upstream into current branch...',
    'watcher.mergeSuccess': 'Merge completed successfully.',
    'watcher.mergeError': 'Failed to execute git merge:',

    // Upstream Sync Toolbar
    'sync.upstreamBehind': 'your branch is behind {upstream}',
    'sync.commitsBehind': '{count} behind',
    'sync.commitsAhead': '{count} ahead',
    'sync.rebase': 'Rebase',
    'sync.merge': 'Merge',
    'sync.pull': 'Pull',
    'sync.syncOptions': 'Sync options with upstream branch',

    // Git Stash Manager
    'stash.title': 'Git Stash Manager',
    'stash.saveBtn': 'Save to Stash',
    'stash.inputPlaceholder': 'Optional descriptive stash message...',
    'stash.empty': 'No saved stashes in this repository.',
    'stash.pop': 'Pop',
    'stash.apply': 'Apply',
    'stash.drop': 'Drop',
    'stash.stashes': 'Stashes:',
  },
};

/**
 * Resolves translation for a key based on selected language
 */
export function t(
  key: string,
  preferredLang: Language = 'auto',
  systemLang: string = 'es',
  params?: Record<string, string | number>
): string {
  let lang: 'es' | 'en' = 'es';

  if (preferredLang === 'es') {
    lang = 'es';
  } else if (preferredLang === 'en') {
    lang = 'en';
  } else {
    // Auto detection
    const normalized = (systemLang || 'es').toLowerCase();
    lang = normalized.startsWith('en') ? 'en' : 'es';
  }

  const locale = LOCALES[lang] || LOCALES.es;
  let text = locale[key] || LOCALES.en[key] || key;

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp(`{${k}}`, 'g'), String(v));
    });
  }

  return text;
}
