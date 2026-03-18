#CodeDock Online Code Editor – Full Documentation

A lightweight, VS Code–style online code editor built with modern web technologies.
Supports tabs, theming, Monaco/CodeMirror integration, auto-save, stdin input, and more.

---

## ✨ Features

### 🎨 **VS Code–Style Theme Switcher**

Switch between:

* **Light**
* **Dark**
* **Dracula**

Themes apply instantly to:

* Editor UI
* Code syntax highlighting
* App layout

---

### 🧠 **Syntax Highlighting Editor**

Choose between:

* **Monaco Editor** (VS Code engine)
* **CodeMirror 6**

Supports:

* Autocomplete
* Syntax highlighting
* Diagnostics (Monaco)
* Language mode configuration

---

### 💾 **Auto-Save to localStorage**

The editor automatically saves:

* All file tabs
* Code content
* Active file
* Selected theme

Everything is restored when the user reloads the page.

---

### 📁 **Multiple File Tabs**

* Add new file
* Close file
* Rename file
* Switch between open files
* Each tab maintains its own editor state

---

### 🧩 **Stdin Input Box**

A dedicated input area to simulate **console input**.
Useful for competitive programming & running compiled languages.

---

### ↔️ **Resizable Panels**

Panels you can resize using drag handles:

* Left file explorer
* Center code editor
* Right output panel

Uses CSS + mouse events or libraries like Split.js.

---

### ⛶ **Full-Screen Editor Mode**

One-click full-screen toggle:

* Expands editor to full viewport
* Hides all sidebars and UI clutter
* Press ESC or toggle button to exit

---

### 📥 **Download Code as a File**

Download the currently active file as:

* `.js`
* `.ts`
* `.py`
* `.cpp`
* `.java`
  (any extension supported)

Uses a Blob + invisible anchor link.

---

## 🏗️ Project Structure

```
/src
  /components
    Editor.jsx
    Tabs.jsx
    Sidebar.jsx
    OutputPanel.jsx
    ThemeSwitcher.jsx
  /utils
    localStorage.js
    fileManager.js
  App.jsx
  index.js
  styles.css

public/
  index.html
README.md
```

---

## ⚙️ Technologies Used

* **React / Vanilla JS**
* **Monaco Editor or CodeMirror**
* **localStorage API**
* **Split.js or custom resizable handles**
* **CSS variables for theming**
* **FileSaver / Blob for downloads**

---

## 🚀 Getting Started

### 1️⃣ Install dependencies

```
npm install
```

### 2️⃣ Run development server

```
npm start
```

### 3️⃣ Build for production

```
npm run build
```

---

## 🧪 How Auto-Save Works

Every time the user types:

```js
localStorage.setItem("editorFiles", JSON.stringify(files));
localStorage.setItem("activeFile", currentFileName);
localStorage.setItem("theme", selectedTheme);
```

At startup:

```js
const saved = JSON.parse(localStorage.getItem("editorFiles"));
```

Everything is automatically restored.

---

## 🎨 Themes Implementation

A global class on `<body>`:

```html
<body class="theme-dark">
```

CSS variables switch per theme:

```css
body.theme-light {
  --bg: #ffffff;
  --text: #000;
}

body.theme-dark {
  --bg: #1e1e1e;
  --text: #f5f5f5;
}

body.theme-dracula {
  --bg: #282a36;
  --text: #f8f8f2;
}
```

---

## 📥 Download File Code Example

```js
function downloadFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
```

---

## 🔧 Resizable Panels

Using Split.js:

```js
Split(['#sidebar', '#editor', '#output'], {
  sizes: [20, 60, 20],
  minSize: 100,
  gutterSize: 6,
});
```

---

## ⛶ Full-Screen Mode

```js
function toggleFullScreen() {
  document.body.classList.toggle("full-screen");
}
```

```css
.full-screen #sidebar,
.full-screen #output,
.full-screen #tabs {
  display: none;
}

.full-screen #editor {
  width: 100vw;
  height: 100vh;
}
```

---

## 📌 Future Enhancements

* Integrated compiler APIs
* Run code in WASM (C++/Python/Rust)
* Cloud sync
* Export project as ZIP

