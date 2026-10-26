const vscode = require('vscode');

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

        
        const url = 'https://www.google.com/search?q=' + encodeURIComponent(error.message);
        vscode.env.openExternal(vscode.Uri.parse(url));
    });

    context.subscriptions.push(cmd);
}

function deactivate() {}

module.exports = { activate, deactivate };