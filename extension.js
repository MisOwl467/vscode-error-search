const vscode = require('vscode');

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

function searchError(message, languageId) {
    const lang = languageName(languageId);
    const query = (lang + ' ' + cleanMessage(message)).trim();
    const url = 'https://www.google.com/search?q=' + encodeURIComponent(query);
    vscode.env.openExternal(vscode.Uri.parse(url));
}

function activate(context) {
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

        
        searchError(error.message, editor.document.languageId);
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
                    arguments: [d.message, document.languageId]
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
        searchError(text, languageId);
    });

    context.subscriptions.push(cmdSelection);
}

function deactivate() {}

module.exports = { activate, deactivate };