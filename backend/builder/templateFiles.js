/**
 * Template Files — base React project scaffold for sandbox apps.
 * The LLM's generated code gets injected into this template.
 * Uses Tailwind CDN for zero-config styling in sandboxed projects.
 */

export const templateFiles = {
  'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Generated App</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script type="text/babel" data-type="module" src="./src/App.jsx"></script>
  <script type="text/babel">
    // Mount the app
    const root = ReactDOM.createRoot(document.getElementById('root'));
    // Wait for App module to load
    window.addEventListener('DOMContentLoaded', () => {
      if (window.AppComponent) {
        root.render(React.createElement(window.AppComponent));
      }
    });
    // Retry mounting after scripts load
    setTimeout(() => {
      if (window.AppComponent) {
        root.render(React.createElement(window.AppComponent));
      }
    }, 1000);
  </script>
</body>
</html>`,

  'src/App.jsx': `// Default App component — will be replaced by AI-generated code
function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
      <div className="text-center text-white">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          AI Website Builder
        </h1>
        <p className="text-gray-400 text-lg">
          Describe your website in the chat to get started
        </p>
      </div>
    </div>
  );
}

window.AppComponent = App;
`,

  'src/index.css': `/* Global styles — Tailwind CDN handles utilities */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`,
};

/**
 * Get the default file for a given path if the LLM didn't generate it.
 */
export function getDefaultFile(filepath) {
  return templateFiles[filepath] || null;
}

/**
 * Get all template file paths.
 */
export function getTemplateFilePaths() {
  return Object.keys(templateFiles);
}
