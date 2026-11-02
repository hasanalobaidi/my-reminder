// Counts the functions a .js/.jsx file declares AT THE TOP LEVEL - column zero, no indentation.
//
// The standing rule is one function per file. Enforcing it needs a definition of "a function"
// that matches how these modules are actually written, and the honest one is positional:
// a module's own function starts at column zero, while callbacks, inner helpers, promise
// bodies and object methods are all indented inside something else. Anchoring to column zero
// therefore counts exactly what the rule is about and ignores everything it is not, without
// needing a parser.
//
// Lines that begin a comment are skipped, so a commented-out declaration or a prose line that
// happens to start with the word "function" is not mistaken for code.
function countTopLevelFunctions(source) {
  const names = [];
  const lines = String(source || '').split('\n');
  let insideBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (insideBlockComment) {
      if (trimmed.includes('*/')) insideBlockComment = false;
      continue;
    }
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) insideBlockComment = true;
      continue;
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    // Indented means it lives inside something else, which the rule does not police.
    if (/^\s/.test(line)) continue;

    let match = line.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z0-9_$]+)?\s*\(/);
    if (match) { names.push(match[1] || '(anonymous)'); continue; }

    // const foo = function ... | const foo = async function ... | const foo = (a) => ... | const foo = async () =>
    match = line.match(/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z0-9_$]+\s*=>)/);
    if (match) { names.push(match[1]); continue; }

    // The browser modules attach their one function to the shared namespace instead of
    // declaring it - window.QNA.doThing = function doThing() - and so does every CommonJS
    // module.exports = fn. Same single top-level function, different spelling.
    match = line.match(/^([A-Za-z0-9_$.]+)\s*=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z0-9_$]+\s*=>)/);
    if (match) { names.push(match[1]); continue; }
  }

  return names;
}

module.exports = countTopLevelFunctions;
