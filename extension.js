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

        
        const lang = languageName(editor.document.languageId);
        const query = lang + ' ' + cleanMessage(error.message);
        const url = 'https://www.google.com/search?q=' + encodeURIComponent(query);
        vscode.env.openExternal(vscode.Uri.parse(url));
    });

    context.subscriptions.push(cmd);
}

function deactivate() {}

module.exports = { activate, deactivate };