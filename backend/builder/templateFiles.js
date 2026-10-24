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
  <script>
    // Expose React hooks as globals so bare useState() etc. works
    var useState = React.useState;
    var useEffect = React.useEffect;
    var useRef = React.useRef;
    var useCallback = React.useCallback;
    var useMemo = React.useMemo;
    var useReducer = React.useReducer;
    var useContext = React.useContext;
    var createContext = React.createContext;
    var Fragment = React.Fragment;
    var useId = React.useId;
    var useSyncExternalStore = React.useSyncExternalStore;
    var useTransition = React.useTransition;
    var useDeferredValue = React.useDeferredValue;

    // Global error handler — show errors visibly instead of white screen
    window.onerror = function(msg, url, line, col, error) {
      var root = document.getElementById('root');
      if (root && (!root.hasChildNodes() || root.innerHTML.trim() === '')) {
        root.innerHTML = '<div style="padding:2rem;font-family:Inter,system-ui,sans-serif;color:#fca5a5;background:#1e1e2e;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">'
          + '<div style="width:48px;height:48px;border-radius:50%;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);display:flex;align-items:center;justify-content:center;margin-bottom:1rem;font-size:24px;">⚠</div>'
          + '<h2 style="font-size:1.1rem;font-weight:600;margin-bottom:0.5rem;">Rendering Error</h2>'
          + '<p style="font-size:0.85rem;color:#a1a1aa;max-width:400px;line-height:1.5;">' + msg + '</p>'
          + '<p style="font-size:0.75rem;color:#71717a;margin-top:0.5rem;">Line ' + (line || '?') + '</p>'
          + '</div>';
      }
    };
  </script>
  <script type="text/babel" data-type="module" src="./src/App.jsx"></script>
  <script type="text/babel">
    // Mount the app with robust polling — waits for Babel to finish transpiling
    (function() {
      var root = ReactDOM.createRoot(document.getElementById('root'));
      var attempts = 0;
      var maxAttempts = 200; // 200 x 50ms = 10 seconds max wait
      function tryMount() {
        if (window.AppComponent) {
          try {
            root.render(React.createElement(window.AppComponent));
          } catch (e) {
            document.getElementById('root').innerHTML =
              '<div style="padding:2rem;font-family:Inter,system-ui,sans-serif;color:#fca5a5;background:#1e1e2e;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">'
              + '<div style="width:48px;height:48px;border-radius:50%;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);display:flex;align-items:center;justify-content:center;margin-bottom:1rem;font-size:24px;">⚠</div>'
              + '<h2 style="font-size:1.1rem;font-weight:600;margin-bottom:0.5rem;">Rendering Error</h2>'
              + '<p style="font-size:0.85rem;color:#a1a1aa;max-width:400px;line-height:1.5;">' + e.message + '</p>'
              + '</div>';
          }
        } else if (++attempts < maxAttempts) {
          setTimeout(tryMount, 50);
        } else {
          document.getElementById('root').innerHTML =
            '<div style="padding:2rem;font-family:Inter,system-ui,sans-serif;color:#fca5a5;background:#1e1e2e;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">'
            + '<div style="width:48px;height:48px;border-radius:50%;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);display:flex;align-items:center;justify-content:center;margin-bottom:1rem;font-size:24px;">⏱</div>'
            + '<h2 style="font-size:1.1rem;font-weight:600;margin-bottom:0.5rem;">Loading Timeout</h2>'
            + '<p style="font-size:0.85rem;color:#a1a1aa;max-width:400px;line-height:1.5;">The app took too long to compile. Please try refreshing.</p>'
            + '</div>';
        }
      }
      tryMount();
    })();
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
