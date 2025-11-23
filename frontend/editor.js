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

// ---------------- SAVE (manual & auto-draft) ----------------
async function saveCurrentFile() {
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
        const response = await fetch("http://127.0.0.1:5000/run", {
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
