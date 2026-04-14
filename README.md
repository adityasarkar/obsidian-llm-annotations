# LLM Annotations — Obsidian Plugin

Highlight passages in your notes and attach feedback for an LLM. Build up multiple annotations, then copy a compiled summary to your clipboard in an LLM-optimized format. Designed for the workflow of iterating on writing with Claude Code or other LLMs.

**Example output copied to clipboard:**

```
File: meeting-notes.md

---

[Lines 3-5] "We should revisit the pricing model before launch"
Feedback: Expand this into a full paragraph with specific numbers from the Q3 report.

---

[Line 12] "TBD"
Feedback: Replace with a concrete timeline — suggest 2 weeks for phase 1.
```

---

## Installation

### Option A: For developers (building from source)

Use this if you want to modify the plugin or contribute to development.

#### Prerequisites

- [Node.js](https://nodejs.org/) v16 or later
- [Git](https://git-scm.com/)
- A GitHub account

#### Steps

1. **Fork the repository**

   Go to the plugin's GitHub repository page and click the **Fork** button in the top-right corner. This creates your own copy of the repo under your GitHub account.

2. **Clone your fork to your machine**

   Open a terminal and run:

   ```bash
   git clone https://github.com/YOUR-USERNAME/obsidian-llm-annotations.git
   ```

   Replace `YOUR-USERNAME` with your GitHub username.

3. **Install dependencies**

   ```bash
   cd obsidian-llm-annotations
   npm install
   ```

4. **Build the plugin**

   For a one-time production build:

   ```bash
   npm run build
   ```

   Or, for development (auto-rebuilds when you edit source files):

   ```bash
   npm run dev
   ```

   This produces `main.js` in the project root.

5. **Copy the plugin into your Obsidian vault**

   You need to copy three files into your vault's plugin directory. Your vault is the folder where your Obsidian notes live.

   ```bash
   # Create the plugin folder inside your vault
   mkdir -p /path/to/your/vault/.obsidian/plugins/llm-annotations

   # Copy the required files
   cp main.js manifest.json styles.css /path/to/your/vault/.obsidian/plugins/llm-annotations/
   ```

   Replace `/path/to/your/vault` with the actual path to your Obsidian vault folder.

   > **Tip:** You can find your vault path by opening Obsidian, clicking the vault icon in the bottom-left corner, and looking at the path shown there.

6. **Enable the plugin in Obsidian**

   1. Open Obsidian and go to **Settings** (gear icon in the bottom-left).
   2. In the left sidebar, click **Community plugins**.
   3. If you see a message about Restricted Mode, click **Turn on community plugins**. This is a one-time step that allows Obsidian to run third-party plugins.
   4. Under **Installed plugins**, find **LLM Annotations** and toggle it on.
   5. Close Settings. You should see a speech-bubble icon in the left ribbon bar.

   > If the plugin doesn't appear in the list, try restarting Obsidian (fully quit and reopen).

---

### Option B: Manual install (no coding required)

Use this if someone shared the plugin files with you, or you downloaded a release.

#### What you need

Three files (you should have received all three):

| File | What it is |
|---|---|
| `main.js` | The plugin code |
| `manifest.json` | Plugin metadata |
| `styles.css` | Plugin styling |

#### Steps

1. **Locate your Obsidian vault folder**

   Your vault is the folder on your computer where Obsidian stores your notes. If you're not sure where it is:

   - Open Obsidian
   - Click the vault name or vault icon in the bottom-left corner
   - The file path is shown there

   For example, it might be something like:
   - macOS: `/Users/yourname/Documents/MyVault`
   - Windows: `C:\Users\yourname\Documents\MyVault`

2. **Show hidden files**

   The `.obsidian` folder is hidden by default. You'll need to make it visible:

   - **macOS:** In Finder, press `Cmd + Shift + .` (period) to toggle hidden files.
   - **Windows:** In File Explorer, click **View** in the toolbar and check **Hidden items**.

3. **Create the plugin folder**

   Navigate into your vault folder and find the `.obsidian` directory. Inside it:

   1. Open the `plugins` folder. If it doesn't exist, create a new folder called `plugins`.
   2. Inside `plugins`, create a new folder called `llm-annotations`.

   Your folder structure should look like this:

   ```
   YourVault/
   └── .obsidian/
       └── plugins/
           └── llm-annotations/
   ```

4. **Copy the plugin files**

   Place all three files (`main.js`, `manifest.json`, `styles.css`) into the `llm-annotations` folder you just created:

   ```
   YourVault/
   └── .obsidian/
       └── plugins/
           └── llm-annotations/
               ├── main.js
               ├── manifest.json
               └── styles.css
   ```

5. **Restart Obsidian**

   Fully quit Obsidian and reopen it so it detects the new plugin.

6. **Enable community plugins**

   If this is the first third-party plugin you're installing:

   1. Open **Settings** (click the gear icon in the bottom-left of Obsidian).
   2. Click **Community plugins** in the left sidebar.
   3. You'll see a warning about Restricted Mode. Click **Turn on community plugins**.

7. **Enable LLM Annotations**

   1. Still in **Settings → Community plugins**, scroll down to **Installed plugins**.
   2. Find **LLM Annotations** in the list.
   3. Toggle the switch next to it to turn it on.
   4. Close Settings.

   You should now see a speech-bubble icon (💬) in the left ribbon bar. The plugin is ready to use.

---

## Usage

1. Open any markdown note in Obsidian.
2. **Select some text** in the editor. A small **Annotate** button appears near your selection.
3. Click the button (or run the **Annotate selection** command). The sidebar opens with a new annotation entry.
4. **Type your feedback** in the text area — this is the instruction or comment you want to pass to the LLM.
5. Repeat for as many passages as you want.
6. Click **Copy all** in the sidebar. The compiled output is now on your clipboard.
7. Paste into Claude Code, ChatGPT, or any other LLM interface.
8. Click **Clear all** when you're done to remove all annotations.

### Commands

All commands are available via the command palette (`Cmd/Ctrl+P`). No default hotkeys are assigned — you can set your own in **Settings → Hotkeys**.

| Command | Description |
|---|---|
| Annotate selection | Annotate the currently selected text |
| Toggle sidebar | Show/hide the annotation sidebar |
| Copy all annotations | Copy all annotations to clipboard |
| Clear all annotations | Remove all annotations |

You can also right-click selected text and choose **Annotate selection** from the context menu.
