async function runCode() {
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
