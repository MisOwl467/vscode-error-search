const vscode = require('vscode');
const path = require('path');

let extContext;
let statusItem;
let panel;

function cleanMessage(text) {
    let s = text;
    s = s.replace(/(?:[A-Za-z]:)?[\\\/]?(?:[\w.\-]+[\\\/])+[\w.\-]+\.\w+/g, '');
    s = s.replace(/:\d+(:\d+)?/g, '');
    s = s.replace(/'[A-Za-z_][^']*'/g, '');
    s = s.replace(/"[A-Za-z_][^"]*"/g, '');
    s = s.replace(/;?\s*did you mean.*$/i, '');
    s = s.replace(/\b(error|warning)\s*:/gi, '');
    s = s.replace(/^[\s:]+/, '');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
}

function languageName(id) {
    const names = {
        cpp: 'Cpp',
        c: 'C',
        python: 'Python',
        javascript: 'JavaScript',
        typescript: 'TypeScript',
        java: 'Java',
        csharp: 'Csharp'
    };
    return names[id] || id;
}

function todayKey(daysAgo = 0) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + month + '-' + day;
}

function getHistory() {
    return extContext.globalState.get('history', []);
}

function addToHistory(entry) {
    const history = getHistory();
    history.push(entry);
    extContext.globalState.update('history', history);
}

function countToday() {
    const today = todayKey();
    return getHistory().filter(h => h.day === today).length;
}

function updateStatus() {
    statusItem.text = '$(search) Errors today: ' + countToday();
}

function countBy(history, key) {
    const counts = {};
    for (const h of history) {
        counts[h[key]] = (counts[h[key]] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function countLastDays(history, days) {
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
        const key = todayKey(i);
        const count = history.filter(h => h.day === key).length;
        result.push([key.slice(5), count]);
    }
    return result;
}

function countByDayPart(history) {
    const parts = [['Night (0–6)', 0], ['Morning (6–12)', 0], ['Day (12–18)', 0], ['Evening (18–24)', 0]];
    for (const h of history) {
        parts[Math.floor(h.hour / 6)][1]++;
    }
    return parts;
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function barsHtml(items) {
    if (items.length === 0) {
        return '<p class="empty">No data yet</p>';
    }
    const max = Math.max(...items.map(i => i[1]), 1);
    return items.map(([label, count]) =>
        '<div class="row">' +
            '<div class="label" title="' + escapeHtml(label) + '">' + escapeHtml(label) + '</div>' +
            '<div class="track"><div class="bar" style="width:' + (count / max * 100) + '%"></div></div>' +
            '<div class="count">' + count + '</div>' +
        '</div>'
    ).join('');
}

function getDashboardHtml() {
    const history = getHistory();
    const lastWeek = countLastDays(history, 7);
    const weekTotal = lastWeek.reduce((sum, d) => sum + d[1], 0);
    const uniqueErrors = countBy(history, 'error').length;

    const nonce = Math.random().toString(36).slice(2);

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 16px 24px; }
    h1 { font-size: 20px; font-weight: 600; margin: 0 0 16px; }
    h2 { font-size: 14px; font-weight: 600; margin: 0 0 12px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .card { background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 12px 16px; }
    .card .num { font-size: 26px; font-weight: 600; }
    .card .name { font-size: 12px; color: var(--vscode-descriptionForeground); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
    .section { background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 14px 16px; }
    .wide { grid-column: 1 / -1; }
    .row { display: flex; align-items: center; gap: 10px; margin: 6px 0; font-size: 12px; }
    .label { width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .track { flex: 1; height: 12px; background: var(--vscode-editor-background); border-radius: 3px; }
    .bar { height: 100%; background: var(--vscode-charts-blue); border-radius: 3px; min-width: 2px; }
    .count { width: 32px; text-align: right; font-variant-numeric: tabular-nums; }
    .empty { color: var(--vscode-descriptionForeground); font-size: 12px; }
    button { margin-top: 20px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);
             border: none; padding: 6px 14px; border-radius: 3px; cursor: pointer; }
    button:hover { background: var(--vscode-button-secondaryHoverBackground); }
</style>
</head>
<body>
    <h1>Error Search statistics</h1>

    <div class="cards">
        <div class="card"><div class="num">${history.length}</div><div class="name">Total searches</div></div>
        <div class="card"><div class="num">${countToday()}</div><div class="name">Today</div></div>
        <div class="card"><div class="num">${weekTotal}</div><div class="name">Last 7 days</div></div>
        <div class="card"><div class="num">${uniqueErrors}</div><div class="name">Different errors</div></div>
    </div>

    <div class="grid">
        <div class="section wide"><h2>Most frequent errors</h2>${barsHtml(countBy(history, 'error').slice(0, 10))}</div>
        <div class="section"><h2>Searches in the last 7 days</h2>${barsHtml(lastWeek)}</div>
        <div class="section"><h2>Time of day</h2>${barsHtml(countByDayPart(history))}</div>
        <div class="section"><h2>Languages</h2>${barsHtml(countBy(history, 'lang'))}</div>
        <div class="section"><h2>Files</h2>${barsHtml(countBy(history, 'file').slice(0, 10))}</div>
    </div>

    <button id="clear">Clear statistics</button>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        document.getElementById('clear').addEventListener('click', () => {
            vscode.postMessage({ type: 'clear' });
        });
    </script>
</body>
</html>`;
}

function showDashboard() {
    if (panel) {
        panel.reveal();
        panel.webview.html = getDashboardHtml();
        return;
    }

    panel = vscode.window.createWebviewPanel(
        'errorSearchStats',
        'Error Search Statistics',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );
    panel.webview.html = getDashboardHtml();

    panel.webview.onDidReceiveMessage(msg => {
        if (msg.type === 'clear') {
            vscode.commands.executeCommand('error-search.clearStats');
        }
    });

    panel.onDidDispose(() => {
        panel = undefined;
    });
}

function refreshDashboard() {
    if (panel) {
        panel.webview.html = getDashboardHtml();
    }
}

function searchError(message, languageId, fileName) {
    const lang = languageName(languageId);
    const cleaned = cleanMessage(message);
    const query = (lang + ' ' + cleaned).trim();

    addToHistory({
        error: cleaned,
        lang: lang || 'unknown',
        file: fileName ? path.basename(fileName) : 'terminal',
        day: todayKey(),
        hour: new Date().getHours()
    });
    updateStatus();
    refreshDashboard();

    const url = 'https://www.google.com/search?q=' + encodeURIComponent(query);
    vscode.env.openExternal(vscode.Uri.parse(url));
}

function activate(context) {
    extContext = context;

    statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusItem.command = 'error-search.showStats';
    statusItem.tooltip = 'Error Search: click to show statistics';
    updateStatus();
    statusItem.show();
    context.subscriptions.push(statusItem);

    const cmd = vscode.commands.registerCommand('error-search.search', () => {

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Откройте файл с кодом');
            return;
        }

        const position = editor.selection.active;

        const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);

        const error = diagnostics.find(d =>
            d.range.start.line <= position.line && position.line <= d.range.end.line
        );

        if (!error) {
            vscode.window.showWarningMessage('На этой строке нет ошибки');
            return;
        }

        searchError(error.message, editor.document.languageId, editor.document.fileName);
    });

    context.subscriptions.push(cmd);

    const cmdMessage = vscode.commands.registerCommand('error-search.searchMessage', searchError);

    const provider = vscode.languages.registerCodeActionsProvider('*', {
        provideCodeActions(document, range, ctx) {
            return ctx.diagnostics.map(d => {
                const action = new vscode.CodeAction(
                    'Find info about error',
                    vscode.CodeActionKind.QuickFix
                );
                action.diagnostics = [d];
                action.command = {
                    command: 'error-search.searchMessage',
                    title: 'Find info about error',
                    arguments: [d.message, document.languageId, document.fileName]
                };
                return action;
            });
        }
    });

    context.subscriptions.push(cmdMessage, provider);

    const cmdSelection = vscode.commands.registerCommand('error-search.searchSelection', async () => {
        const editor = vscode.window.activeTextEditor;
        let text = '';

        if (editor && !editor.selection.isEmpty) {
            text = editor.document.getText(editor.selection);
        }
        else {
            await vscode.commands.executeCommand('workbench.action.terminal.copySelection');
            text = await vscode.env.clipboard.readText();
        }

        if (!text.trim()) {
            vscode.window.showWarningMessage('Выделите текст ошибки');
            return;
        }

        const languageId = editor ? editor.document.languageId : '';
        const fileName = editor ? editor.document.fileName : '';
        searchError(text, languageId, fileName);
    });

    context.subscriptions.push(cmdSelection);

    const cmdStats = vscode.commands.registerCommand('error-search.showStats', showDashboard);

    const cmdClear = vscode.commands.registerCommand('error-search.clearStats', () => {
        extContext.globalState.update('history', []);
        updateStatus();
        refreshDashboard();
        vscode.window.showInformationMessage('Statistics cleared');
    });

    context.subscriptions.push(cmdStats, cmdClear);
}

function deactivate() {}

module.exports = { activate, deactivate };