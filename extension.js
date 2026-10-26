const vscode = require('vscode');
const path = require('path');

let extContext;
let statusItem;

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

function todayKey() {
    const d = new Date();
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

    const cmdStats = vscode.commands.registerCommand('error-search.showStats', () => {
        const history = getHistory();
        if (history.length === 0) {
            vscode.window.showInformationMessage('No searches yet');
            return;
        }

        const counts = {};
        for (const h of history) {
            counts[h.error] = (counts[h.error] || 0) + 1;
        }

        let topError = '';
        let topCount = 0;
        for (const e in counts) {
            if (counts[e] > topCount) {
                topCount = counts[e];
                topError = e;
            }
        }

        vscode.window.showInformationMessage(
            'Total searches: ' + history.length +
            ' | Today: ' + countToday() +
            ' | Most frequent: "' + topError + '" (' + topCount + ')'
        );
    });

    const cmdClear = vscode.commands.registerCommand('error-search.clearStats', () => {
        extContext.globalState.update('history', []);
        updateStatus();
        vscode.window.showInformationMessage('Statistics cleared');
    });

    context.subscriptions.push(cmdStats, cmdClear);
}

function deactivate() {}

module.exports = { activate, deactivate };