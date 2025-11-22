async function runCode() {
    saveCurrentFile();
    const code = document.getElementById("code").value;
    const language = document.getElementById("language").value;

    const response = await fetch("http://127.0.0.1:5000/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code })
    });

    const result = await response.json();
    document.getElementById("output").innerText = result.output;
}

// Enable TAB key and auto indentation inside textarea
const codeEditor = document.getElementById("code");

codeEditor.addEventListener("keydown", function (e) {
    const start = this.selectionStart;
    const end = this.selectionEnd;

    // TAB key -> insert 4 spaces
    if (e.key === "Tab") {
        e.preventDefault();
        this.value = this.value.substring(0, start) + "    " + this.value.substring(end);
        this.selectionStart = this.selectionEnd = start + 4;
    }

    // Auto-indent on Enter
    if (e.key === "Enter") {
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

let files = {};
let currentFile = "";

// Create first file on load
window.onload = () => {
    createFile("untitled_1", "");
};


// ========= CREATE NEW FILE INPUT ========= //
function createNewTabInput() {
    const fileTabs = document.getElementById("fileTabs");

    // Create a temporary input row
    const li = document.createElement("li");
    li.className = "list-group-item";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Enter file name";
    input.className = "form-control";
    input.autofocus = true;

    li.appendChild(input);
    fileTabs.appendChild(li);

    // On Enter → create file
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            let name = input.value.trim();

            if (name === "") {
                name = "untitled_" + (Object.keys(files).length + 1);
            }

            if (files[name]) {
                name = name + "_" + Date.now(); // Make unique
            }

            createFile(name, "");
            refreshTabs();
        }
    });
}


// ========= CREATE FILE ========= //
function createFile(name, content = "") {
    files[name] = content;
    currentFile = name;
    refreshTabs();
    loadCurrentFile();
}


// ========= DELETE FILE ========= //
function deleteFile(name) {
    delete files[name];

    // If deleting active file
    if (currentFile === name) {
        const remaining = Object.keys(files);
        currentFile = remaining.length ? remaining[0] : "";
    }

    refreshTabs();
    loadCurrentFile();
}


// ========= REFRESH TABS ========= //
function refreshTabs() {
    const fileTabs = document.getElementById("fileTabs");
    fileTabs.innerHTML = "";

    Object.keys(files).forEach(filename => {
        const li = document.createElement("li");
        li.className = "list-group-item d-flex justify-content-between align-items-center " +
            (filename === currentFile ? "active" : "");

        // Filename text
        const span = document.createElement("span");
        span.textContent = filename;
        span.onclick = () => {
            saveCurrentFile();
            currentFile = filename;
            loadCurrentFile();
            refreshTabs();
        };

        // Delete Button
        const del = document.createElement("button");
        del.textContent = "✖";
        del.className = "btn btn-sm btn-danger ms-2";
        del.onclick = (event) => {
            event.stopPropagation(); // Prevent triggering tab click
            deleteFile(filename);
        };

        li.appendChild(span);
        li.appendChild(del);
        fileTabs.appendChild(li);
    });
}


// ========= LOAD SELECTED FILE ========= //
function loadCurrentFile() {
    const editor = document.getElementById("code");
    editor.value = currentFile ? files[currentFile] : "";
}


// ========= SAVE CONTENT ========= //
function saveCurrentFile() {
    if (currentFile) {
        files[currentFile] = document.getElementById("code").value;
    }
}
