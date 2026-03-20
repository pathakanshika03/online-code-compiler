// editor.js
// Assumes app.js defines: api(url, method, body), getToken(), logout(), applyTheme()/loadTheme() etc.

// FILES state
let files = [];              // [{id, filename, content, unsaved:false}]
let currentFile = null;      // id
let isSaving = false;        // prevents concurrent saves
let autoDraftInterval = 30000; // 30s

// Load files on start, and load theme
window.addEventListener("DOMContentLoaded", async () => {
    // Load theme if function exists
    if (typeof loadTheme === "function") loadTheme();

    try {
        const data = await api("/files", "GET"); // returns list of {id, filename, content}
        files = Array.isArray(data) ? data.map(f => ({...f, unsaved: false})) : [];
        renderTabs();
        if (files.length) openFile(files[0].id);
    } catch (err) {
        console.error("Failed to load files:", err);
        files = [];
        renderTabs();
    }

    // Setup keyboard shortcuts and auto-draft
    setupShortcuts();
    startAutoDraft();
});

// ---------------- RENDER TABS ----------------
function renderTabs() {
    const fileTabs = document.getElementById("fileTabs");
    fileTabs.innerHTML = "";

    files.forEach(f => {
        const li = document.createElement("li");
        li.className =
            "list-group-item d-flex justify-content-between align-items-center file-tab";
        
        if (f.id === currentFile) li.classList.add("active");

        // --- Clicking tab opens file ---
        li.addEventListener("click", () => {
            switchToFile(f.id);
        });

        // Filename element
        const nameSpan = document.createElement("span");
        nameSpan.textContent = f.filename;
        nameSpan.style.cursor = "pointer";

        // Delete button
        const delBtn = document.createElement("button");
        delBtn.textContent = "✖";
        delBtn.className = "btn btn-sm btn-danger";

        // --- Prevent delete click from triggering tab click ---
        delBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            deleteFile(f.id);
        });

        li.appendChild(nameSpan);
        li.appendChild(delBtn);
        fileTabs.appendChild(li);
    });
}

function switchToFile(fileId) {
    currentFile = fileId;
    saveCurrentFile();
    openFile(fileId);
}

function openFile(id) {
    const file = files.find(f => f.id === id);
    if (!file) return;

    currentFile = id;
    document.getElementById("code").value = file.content;

    renderTabs();  // refresh highlight
}


// ---------------- CREATE NEW FILE (inline input)
function createFileInput() {
    if (!requireAuth("create files")) return;

    const lang = document.getElementById("language").value;

    const newFile = {
        name: "new_file",
        content: DEFAULT_CODE[lang]
    };
    const fileTabs = document.getElementById("fileTabs");

    const li = document.createElement("li");
    li.className = "list-group-item";

    const input = document.createElement("input");
    input.className = "form-control";
    input.placeholder = "Enter filename (press Enter)";
    li.appendChild(input);
    fileTabs.prepend(li);
    input.focus();

    input.addEventListener("keydown", async (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const name = input.value.trim() || `untitled_${files.length + 1}`;
            // create on server
            try {
                const res = await api("/files", "POST", { filename: name, content: "" });
                const newId = res.id;
                currentFile = newId;
                const newFile = { id: newId, filename: name, content: "", unsaved: false };
                files.unshift(newFile);
                renderTabs();
                openFile(newId);
            } catch (err) {
                console.error("Create file failed:", err);
                alert("Failed to create file.");
            }
        }
        if (e.key === "Escape") {
            // cancel input
            li.remove();
            renderTabs();
        }
    });
}

// ---------------- MARK UNSAVED WHEN TYPING ----------------
const codeEl = document.getElementById("code");
codeEl.addEventListener("input", () => {
    if (!currentFile) return;
    const f = files.find(x => x.id === currentFile);
    if (!f) return;
    f.content = codeEl.value;
    if (!f.unsaved) {
        f.unsaved = true;
        renderTabs();
        updateSaveButton(true);
    }
});

function requireAuth(actionName = "perform this action") {
    const isLoggedIn = sessionStorage.getItem("isloggedIn");

    if (isLoggedIn !== "Y") {
        alert(`Please login first to ${actionName}`);
        return false;
    }
    return true;
}

// ---------------- SAVE (manual & auto-draft) ----------------
async function saveCurrentFile() {
    if (!requireAuth("save files")) return;
    if (!currentFile) {
        alert("No file is open to save");
        return;
    }
    if (isSaving) return; // avoid concurrent saves
    isSaving = true;
    updateSaveButton(true, "Saving...");

    const f = files.find(x => x.id === currentFile);
    if (!f) {
        isSaving = false;
        updateSaveButton(false);
        return;
    }

    try {
        // call update endpoint: PUT /files/<id>
        await api(`/files/${currentFile}`, "PUT", {
            filename: f.filename,
            content: f.content || ""
        });

        f.unsaved = false;
        updateSaveButton(false, "💾 Saved");
        renderTabs();
        // show saved then revert button label
        setTimeout(() => updateSaveButton(false), 1200);
    } catch (err) {
        console.error("Save failed:", err);
        alert("Save failed. Check console.");
        updateSaveButton(true, "Save");
    } finally {
        isSaving = false;
    }
}

// handy: set save button label/state
function updateSaveButton(active, text) {
    const btn = document.getElementById("saveBtn");
    if (!btn) return;
    if (active) {
        btn.classList.remove("btn-secondary");
        btn.classList.add("btn-warning");
    } else {
        btn.classList.remove("btn-warning");
        btn.classList.add("btn-secondary");
    }
    btn.innerText = text || (active ? "Saving..." : "💾 Save");
}

// ---------------- AUTO-DRAFT (non-blocking every 30s) ----------------
let autoDraftTimer = null;
function startAutoDraft() {
    if (autoDraftTimer) clearInterval(autoDraftTimer);
    autoDraftTimer = setInterval(() => {
        // find any file with unsaved == true
        const toSave = files.find(f => f.unsaved);
        if (toSave && !isSaving) {
            // call saveCurrentFile for that file
            // we save the currently open file; if another file is unsaved, user will save it manually
            if (toSave.id === currentFile) {
                // auto-save current file (non-blocking)
                console.log("Auto-drafting current file:", toSave.filename);
                saveCurrentFile().catch(e => console.error("Auto-draft failed", e));
            } else {
                // Optionally, update that file directly if you want background saves for all unsaved:
                // backgroundSaveFile(toSave);
                console.log("Draft exists in other file; leaving for manual save.");
            }
        }
    }, autoDraftInterval);
}

// optional background save for arbitrary file (not used by default)
async function backgroundSaveFile(fileObj) {
    if (!fileObj || isSaving) return;
    isSaving = true;
    try {
        await api(`/files/${fileObj.id}`, "PUT", {
            filename: fileObj.filename,
            content: fileObj.content || ""
        });
        fileObj.unsaved = false;
        renderTabs();
    } catch (err) {
        console.error("backgroundSaveFile failed", err);
    } finally {
        isSaving = false;
    }
}

// ---------------- KEYBOARD SHORTCUTS ----------------
function setupShortcuts() {
    document.addEventListener("keydown", (e) => {
        // Ctrl/Cmd + S
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
            e.preventDefault();
            saveCurrentFile();
        }

        // Ctrl/Cmd + Enter => run
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            runCode();
        }
    });
}

// ---------------- DELETE FILE ----------------
async function deleteFile(id) {
    if (!confirm("Delete this file?")) return;
    try {
        await api(`/files/${id}`, "DELETE");
        files = files.filter(f => f.id !== id);

        // open next file or clear editor
        if (files.length > 0) openFile(files[0].id);
        else {
            currentFile = null;
            document.getElementById("code").value = "";
            document.getElementById("output").innerText = "";
            renderTabs();
        }
    } catch (err) {
        console.error("Delete failed", err);
        alert("Delete failed.");
    }
}

// ---------------- RUN CODE ----------------
async function runCode() {
    // Make sure latest content is used (optionally save first)
    if (currentFile) {
        const f = files.find(x => x.id === currentFile);
        if (f && f.unsaved) {
            // optional: ask user to save before run
            const doSave = confirm("You have unsaved changes. Save before running?");
            if (doSave) await saveCurrentFile();
        }
    }

    const code = document.getElementById("code").value;
    const language = document.getElementById("language").value;

    try {
        const response = await fetch("https://online-code-compiler-backend-bo31.onrender.com/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ language, code })
        });
        const result = await response.json();
        document.getElementById("output").innerText = result.output;
    } catch (err) {
        console.error("Run failed", err);
        document.getElementById("output").innerText = "Execution failed. See console.";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const isLoggedIn = sessionStorage.getItem("isloggedIn") ? "Y" : "N"; 
    const authButton = document.getElementById("authButton");
    const saveButton = document.getElementById("saveBtn");
    if (isLoggedIn === "Y") {
        authButton.innerHTML = `
            <button class="btn btn-danger" onclick="logout()">Logout</button>
        `;
        saveButton.style.display = "inline-block";
    } else {
        authButton.innerHTML = `
            <button class="btn btn-primary" onclick="goLogin()">Login</button>
        `;
        saveButton.style.display = "none";
    }
});

function goLogin() {
    window.location.href = "login.html";
}

const codeEditor = document.getElementById("code");

// Global flag: set to true when autocomplete dropdown is open
let autocompleteActive = false;

codeEditor.addEventListener("keydown", function (e) {
    const start = this.selectionStart;
    const end = this.selectionEnd;

    // TAB key -> insert 4 spaces (skip if autocomplete is handling it)
    if (e.key === "Tab" && !autocompleteActive) {
        e.preventDefault();
        this.value = this.value.substring(0, start) + "    " + this.value.substring(end);
        this.selectionStart = this.selectionEnd = start + 4;
    }

    // Auto-indent on Enter (skip if autocomplete is handling it)
    if (e.key === "Enter" && !autocompleteActive) {
        e.preventDefault();

        // Get current line
        let lineStart = this.value.lastIndexOf("\n", start - 1) + 1;
        let currentLine = this.value.substring(lineStart, start);

        // Count leading spaces
        let indentMatch = currentLine.match(/^\s+/);
        let indent = indentMatch ? indentMatch[0] : "";

        // If previous line ends with a colon { } (Python, C, C++, JS)
        if (/[{\(:]$/.test(currentLine.trim())) {
            indent += "    "; // add one indentation level
        }

        const newText =
            this.value.substring(0, start) +
            "\n" + indent +
            this.value.substring(end);

        this.value = newText;
        this.selectionStart = this.selectionEnd = start + 1 + indent.length;
    }
});

const DEFAULT_CODE = {
    python: `# 🐍 Python Starter
# Write your code below
# Example: print output to console

print("Hello, World!")

# Try:
# name = input("Enter your name: ")
# print("Hello", name)
`,

    javascript: `// ⚡ JavaScript Starter
// Write your code below
// Example: log output to console

console.log("Hello, World!");

// Try:
// let name = prompt("Enter your name:");
// console.log("Hello " + name);
`,

    java: `// ☕ Java Starter
// File name must be Main.java

public class Main {
    public static void main(String[] args) {

        System.out.println("Hello, World!");

        // Try:
        // Scanner sc = new Scanner(System.in);
        // String name = sc.nextLine();
        // System.out.println("Hello " + name);
    }
}
`,

    c: `// 🔧 C Starter
#include <stdio.h>

int main() {

    printf("Hello, World!\\n");

    // Try:
    // int num;
    // scanf("%d", &num);
    // printf("You entered: %d", num);

    return 0;
}
`,

    cpp: `// 🚀 C++ Starter
#include <iostream>
using namespace std;

int main() {

    cout << "Hello, World!" << endl;

    // Try:
    // int num;
    // cin >> num;
    // cout << "You entered: " << num;

    return 0;
}
`
};

window.addEventListener("DOMContentLoaded", () => {
    const lang = document.getElementById("language").value;
    document.getElementById("code").value = DEFAULT_CODE[lang];
});

document.getElementById("language").addEventListener("change", function () {
    const lang = this.value;
    const codeBox = document.getElementById("code");

    if (!codeBox.value || Object.values(DEFAULT_CODE).includes(codeBox.value)) {
        codeBox.value = DEFAULT_CODE[lang];
    }
});

// ============================================================
// DRAG-TO-RESIZE HANDLES
// ============================================================
(function initResizers() {
    const handleV = document.getElementById("resizeHandleV");
    const handleH = document.getElementById("resizeHandleH");

    if (!handleV && !handleH) return; // nothing to initialise

    // -------- Vertical: sidebar ↔ editor width --------
    if (handleV) {
        const wrapper = document.querySelector(".editor-wrapper");
        const filePanel = document.querySelector(".file-panel");

        let isDraggingV = false;

        handleV.addEventListener("mousedown", (e) => {
            e.preventDefault();
            isDraggingV = true;
            handleV.classList.add("active");
            document.body.classList.add("resizing");
        });

        document.addEventListener("mousemove", (e) => {
            if (!isDraggingV) return;

            requestAnimationFrame(() => {
                const wrapperRect = wrapper.getBoundingClientRect();
                let newWidth = e.clientX - wrapperRect.left;

                // Clamp to min/max
                const minW = 150;
                const maxW = wrapperRect.width * 0.5;
                newWidth = Math.max(minW, Math.min(newWidth, maxW));

                filePanel.style.width = newWidth + "px";
            });
        });

        document.addEventListener("mouseup", () => {
            if (isDraggingV) {
                isDraggingV = false;
                handleV.classList.remove("active");
                document.body.classList.remove("resizing");
            }
        });
    }

    // -------- Horizontal: editor ↔ output height --------
    if (handleH) {
        const editorPanel = document.querySelector(".editor-panel");
        const editorContainer = document.querySelector(".editor-container");
        const outputContainer = document.querySelector(".output-container");

        let isDraggingH = false;

        handleH.addEventListener("mousedown", (e) => {
            e.preventDefault();
            isDraggingH = true;
            handleH.classList.add("active");
            document.body.classList.add("resizing-h");
        });

        document.addEventListener("mousemove", (e) => {
            if (!isDraggingH) return;

            requestAnimationFrame(() => {
                const panelRect = editorPanel.getBoundingClientRect();
                // Available space = panel height minus topbar and gaps
                const topbar = document.querySelector(".editor-topbar");
                const topbarHeight = topbar ? topbar.offsetHeight : 0;
                const gaps = 15 * 3; // 3 gap spaces (topbar-editor, editor-handle, handle-output)
                const handleHeight = handleH.offsetHeight;

                const availableHeight = panelRect.height - topbarHeight - gaps - handleHeight;
                let editorHeight = e.clientY - panelRect.top - topbarHeight - gaps / 2;

                // Clamp
                const minEditor = 120;
                const minOutput = 80;
                editorHeight = Math.max(minEditor, Math.min(editorHeight, availableHeight - minOutput));
                const outputHeight = availableHeight - editorHeight;

                editorContainer.style.flex = "none";
                editorContainer.style.height = editorHeight + "px";
                outputContainer.style.height = outputHeight + "px";
            });
        });

        document.addEventListener("mouseup", () => {
            if (isDraggingH) {
                isDraggingH = false;
                handleH.classList.remove("active");
                document.body.classList.remove("resizing-h");
            }
        });
    }
})();

// ============================================================
// AUTOCOMPLETE FOR CODE EDITOR
// ============================================================
(function initAutocomplete() {
    const codeArea = document.getElementById("code");
    const editorContainer = document.querySelector(".editor-container");
    if (!codeArea || !editorContainer) return;

    // Make editor-container the positioning parent (for mirror)
    document.body.style.position = "relative";

    // ---- Language keyword / builtin dictionaries ----
    const AUTOCOMPLETE_DICT = {
        python: [
            // keywords
            "False", "None", "True", "and", "as", "assert", "async", "await",
            "break", "class", "continue", "def", "del", "elif", "else",
            "except", "finally", "for", "from", "global", "if", "import",
            "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise",
            "return", "try", "while", "with", "yield",
            // builtins
            "print", "input", "len", "range", "int", "str", "float", "list",
            "dict", "set", "tuple", "type", "isinstance", "enumerate",
            "zip", "map", "filter", "sorted", "reversed", "abs", "sum",
            "min", "max", "open", "super", "property", "staticmethod",
            "classmethod", "hasattr", "getattr", "setattr", "format",
            "round", "hex", "oct", "bin", "chr", "ord", "id", "hash",
            "any", "all", "next", "iter", "vars", "dir", "help",
            "ValueError", "TypeError", "KeyError", "IndexError",
            "AttributeError", "RuntimeError", "Exception",
            "__init__", "__str__", "__repr__", "__name__", "__main__"
        ],
        javascript: [
            // keywords
            "async", "await", "break", "case", "catch", "class", "const",
            "continue", "debugger", "default", "delete", "do", "else",
            "export", "extends", "finally", "for", "function", "if",
            "import", "in", "instanceof", "let", "new", "of", "return",
            "static", "super", "switch", "this", "throw", "try", "typeof",
            "var", "void", "while", "with", "yield",
            // builtins
            "console", "console.log", "console.error", "console.warn",
            "document", "document.getElementById", "document.querySelector",
            "document.querySelectorAll", "document.createElement",
            "window", "setTimeout", "setInterval", "clearTimeout",
            "clearInterval", "fetch", "Promise", "JSON.parse",
            "JSON.stringify", "Math.floor", "Math.ceil", "Math.random",
            "Math.max", "Math.min", "Array.isArray", "Object.keys",
            "Object.values", "Object.entries", "parseInt", "parseFloat",
            "addEventListener", "removeEventListener", "preventDefault",
            "toString", "valueOf", "length", "push", "pop", "shift",
            "unshift", "splice", "slice", "map", "filter", "reduce",
            "forEach", "find", "includes", "indexOf", "join", "split",
            "replace", "trim", "toUpperCase", "toLowerCase",
            "null", "undefined", "true", "false", "NaN", "Infinity"
        ],
        java: [
            // keywords
            "abstract", "assert", "boolean", "break", "byte", "case",
            "catch", "char", "class", "const", "continue", "default",
            "do", "double", "else", "enum", "extends", "final", "finally",
            "float", "for", "goto", "if", "implements", "import",
            "instanceof", "int", "interface", "long", "native", "new",
            "package", "private", "protected", "public", "return", "short",
            "static", "strictfp", "super", "switch", "synchronized",
            "this", "throw", "throws", "transient", "try", "void",
            "volatile", "while",
            // builtins
            "System.out.println", "System.out.print", "System.exit",
            "String", "Integer", "Double", "Float", "Boolean", "Long",
            "Character", "Math.abs", "Math.max", "Math.min", "Math.pow",
            "Math.sqrt", "Math.random", "ArrayList", "HashMap", "HashSet",
            "LinkedList", "Scanner", "Arrays.sort", "Collections.sort",
            "StringBuilder", "StringBuffer", "Override", "Deprecated",
            "IOException", "Exception", "RuntimeException",
            "NullPointerException", "IndexOutOfBoundsException",
            "null", "true", "false", "main", "args", "length", "equals",
            "toString", "compareTo", "charAt", "substring", "indexOf",
            "contains", "isEmpty", "toCharArray", "valueOf", "parseInt"
        ],
        c: [
            // keywords
            "auto", "break", "case", "char", "const", "continue",
            "default", "do", "double", "else", "enum", "extern", "float",
            "for", "goto", "if", "inline", "int", "long", "register",
            "restrict", "return", "short", "signed", "sizeof", "static",
            "struct", "switch", "typedef", "union", "unsigned", "void",
            "volatile", "while",
            // common functions / macros
            "printf", "scanf", "fprintf", "fscanf", "sprintf", "sscanf",
            "malloc", "calloc", "realloc", "free", "sizeof",
            "strlen", "strcpy", "strncpy", "strcat", "strcmp", "strncmp",
            "memset", "memcpy", "memmove", "memcmp",
            "fopen", "fclose", "fread", "fwrite", "fgets", "fputs",
            "NULL", "EOF", "EXIT_SUCCESS", "EXIT_FAILURE",
            "stdin", "stdout", "stderr",
            "#include", "#define", "#ifdef", "#ifndef", "#endif",
            "#pragma", "#if", "#else"
        ],
        cpp: [
            // keywords (C++ additions to C)
            "alignas", "alignof", "auto", "bool", "break", "case",
            "catch", "char", "class", "const", "constexpr", "continue",
            "decltype", "default", "delete", "do", "double", "dynamic_cast",
            "else", "enum", "explicit", "export", "extern", "false",
            "float", "for", "friend", "goto", "if", "inline", "int",
            "long", "mutable", "namespace", "new", "noexcept", "nullptr",
            "operator", "private", "protected", "public", "register",
            "reinterpret_cast", "return", "short", "signed", "sizeof",
            "static", "static_cast", "struct", "switch", "template",
            "this", "throw", "true", "try", "typedef", "typeid",
            "typename", "union", "unsigned", "using", "virtual", "void",
            "volatile", "while",
            // STL / builtins
            "cout", "cin", "cerr", "endl", "string", "vector", "map",
            "set", "unordered_map", "unordered_set", "pair", "queue",
            "stack", "deque", "priority_queue", "list", "array",
            "sort", "reverse", "find", "count", "lower_bound",
            "upper_bound", "begin", "end", "size", "push_back",
            "pop_back", "front", "back", "insert", "erase", "clear",
            "empty", "swap", "make_pair", "to_string", "stoi", "stod",
            "getline", "substr", "length", "npos",
            "printf", "scanf", "malloc", "free",
            "#include", "#define", "#ifdef", "#ifndef", "#endif",
            "iostream", "cstdio", "cstring", "algorithm", "cmath",
            "std", "using namespace std"
        ]
    };

    let dropdown = null;    // the DOM element
    let activeIndex = -1;   // currently highlighted item
    let matches = [];       // current filtered matches
    let currentWord = "";   // the partial word being completed

    // Sync global flag so the existing Tab/Enter handler defers
    function setAutocompleteFlag(val) {
        autocompleteActive = val;
    }

    // ---- Create a hidden mirror div to measure cursor position ----
    const mirror = document.createElement("div");
    mirror.style.cssText = `
        position: fixed;
        visibility: hidden;
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow: hidden;
        font-family: monospace;
        font-size: 14px;
        padding: 20px;
        border: none;
        box-sizing: border-box;
        pointer-events: none;
    `;
    document.body.appendChild(mirror);

    // ---- Get caret coordinates (viewport-relative) ----
    function getCaretCoords() {
        const textareaRect = codeArea.getBoundingClientRect();

        // Position mirror exactly over the textarea
        mirror.style.top = textareaRect.top + "px";
        mirror.style.left = textareaRect.left + "px";
        mirror.style.width = textareaRect.width + "px";
        mirror.style.height = textareaRect.height + "px";

        // Fill mirror with text up to cursor, accounting for textarea scroll
        const text = codeArea.value.substring(0, codeArea.selectionStart);
        mirror.textContent = text;
        mirror.scrollTop = codeArea.scrollTop;
        mirror.scrollLeft = codeArea.scrollLeft;

        // Add a span to mark caret position
        const span = document.createElement("span");
        span.textContent = "\u200b"; // zero-width space
        mirror.appendChild(span);

        const spanRect = span.getBoundingClientRect();

        return {
            left: spanRect.left,
            top: spanRect.bottom + 2 // just below the caret line
        };
    }

    // ---- Extract the word being typed at cursor ----
    function getCurrentWord() {
        const pos = codeArea.selectionStart;
        const text = codeArea.value;
        // Walk backward to find word start (letters, digits, underscore, dot, #)
        let start = pos;
        while (start > 0 && /[\w.#]/.test(text[start - 1])) {
            start--;
        }
        return { word: text.substring(start, pos), start, end: pos };
    }

    // ---- Show dropdown ----
    function showDropdown(filteredMatches, coords) {
        hideDropdown();
        if (filteredMatches.length === 0) return;
        setAutocompleteFlag(true);

        matches = filteredMatches;
        activeIndex = 0;

        dropdown = document.createElement("div");
        dropdown.className = "autocomplete-dropdown";
        dropdown.style.position = "fixed";
        dropdown.style.left = coords.left + "px";
        dropdown.style.top = coords.top + "px";

        matches.forEach((m, i) => {
            const item = document.createElement("div");
            item.className = "ac-item" + (i === 0 ? " active" : "");
            item.innerHTML = `<span>${highlightMatch(m, currentWord)}</span>`;
            item.addEventListener("mousedown", (e) => {
                e.preventDefault();
                acceptSuggestion(i);
            });
            dropdown.appendChild(item);
        });

        document.body.appendChild(dropdown);
    }

    // ---- Highlight the matching portion ----
    function highlightMatch(text, partial) {
        const idx = text.toLowerCase().indexOf(partial.toLowerCase());
        if (idx === -1) return text;
        const before = text.substring(0, idx);
        const match = text.substring(idx, idx + partial.length);
        const after = text.substring(idx + partial.length);
        return `${before}<b>${match}</b>${after}`;
    }

    // ---- Hide dropdown ----
    function hideDropdown() {
        if (dropdown) {
            dropdown.remove();
            dropdown = null;
        }
        activeIndex = -1;
        matches = [];
        setAutocompleteFlag(false);
    }

    // ---- Accept a suggestion ----
    function acceptSuggestion(index) {
        const suggestion = matches[index];
        if (!suggestion) return;

        const { word, start, end } = getCurrentWord();
        const before = codeArea.value.substring(0, start);
        const after = codeArea.value.substring(end);
        codeArea.value = before + suggestion + after;
        const newPos = start + suggestion.length;
        codeArea.selectionStart = codeArea.selectionEnd = newPos;

        hideDropdown();

        // Trigger input event so unsaved state updates
        codeArea.dispatchEvent(new Event("input", { bubbles: true }));
    }

    // ---- Update active highlight ----
    function updateActive() {
        if (!dropdown) return;
        const items = dropdown.querySelectorAll(".ac-item");
        items.forEach((el, i) => {
            el.classList.toggle("active", i === activeIndex);
        });
        // Scroll active item into view
        if (items[activeIndex]) {
            items[activeIndex].scrollIntoView({ block: "nearest" });
        }
    }

    // ---- Input listener: trigger autocomplete ----
    codeArea.addEventListener("input", () => {
        const { word } = getCurrentWord();
        currentWord = word;

        if (word.length < 2) {
            hideDropdown();
            return;
        }

        const lang = document.getElementById("language").value;
        const dict = AUTOCOMPLETE_DICT[lang] || [];
        const lowerWord = word.toLowerCase();

        // Filter: starts-with first, then contains
        const startsWith = dict.filter(k =>
            k.toLowerCase().startsWith(lowerWord) && k.toLowerCase() !== lowerWord
        );
        const contains = dict.filter(k =>
            !k.toLowerCase().startsWith(lowerWord) &&
            k.toLowerCase().includes(lowerWord) &&
            k.toLowerCase() !== lowerWord
        );
        const filtered = [...startsWith, ...contains].slice(0, 8);

        if (filtered.length === 0) {
            hideDropdown();
            return;
        }

        const coords = getCaretCoords();
        showDropdown(filtered, coords);
    });

    // ---- Keyboard navigation (intercept before the main keydown handler) ----
    codeArea.addEventListener("keydown", (e) => {
        if (!dropdown) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            activeIndex = (activeIndex + 1) % matches.length;
            updateActive();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            activeIndex = (activeIndex - 1 + matches.length) % matches.length;
            updateActive();
        } else if (e.key === "Tab" || e.key === "Enter") {
            if (matches.length > 0 && activeIndex >= 0) {
                e.preventDefault();
                e.stopPropagation();
                acceptSuggestion(activeIndex);
            }
        } else if (e.key === "Escape") {
            hideDropdown();
        }
    });

    // ---- Hide on blur ----
    codeArea.addEventListener("blur", () => {
        // Slight delay so mousedown on dropdown items can fire first
        setTimeout(hideDropdown, 150);
    });

    // ---- Hide on scroll inside textarea ----
    codeArea.addEventListener("scroll", hideDropdown);
})();