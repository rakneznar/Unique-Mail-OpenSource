const port = Number(process.argv[2] || 9334);

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function targets() {
  const response = await fetch(`http://127.0.0.1:${port}/json`);
  return response.json();
}

async function connect(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let sequence = 0;
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data));
    if (!message.id || !pending.has(message.id)) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else if (message.result?.exceptionDetails) request.reject(new Error(message.result.exceptionDetails.exception?.description || message.result.exceptionDetails.text));
    else request.resolve(message.result);
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  return {
    evaluate(expression) {
      const id = ++sequence;
      socket.send(JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression, awaitPromise: true, returnByValue: true }
      }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    close() { socket.close(); }
  };
}

async function waitForTarget(predicate, timeout = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const target = (await targets()).find(predicate);
    if (target) return target;
    await delay(200);
  }
  throw new Error('Renderer target was not available in time.');
}

(async () => {
  const mainTarget = await waitForTarget(target => target.type === 'page' && !target.url.includes('uniqueMailDetachedCompose'));
  const main = await connect(mainTarget);
  await main.evaluate(`window.uniqueMailNative.detachCompose({to:'test@example.com',cc:'',bcc:'',subject:'Paste smoke test',body:'Start ',attachments:[]})`);

  const composeTarget = await waitForTarget(target => target.type === 'page' && target.url.includes('uniqueMailDetachedCompose=1'));
  const compose = await connect(composeTarget);
  await compose.evaluate(`new Promise(resolve => {
    const wait = () => document.querySelector('[contenteditable]') ? resolve(true) : setTimeout(wait, 50);
    wait();
  })`);

  const formatted = await compose.evaluate(`(async () => {
    const editor = document.querySelector('[contenteditable]');
    editor.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    const clipboard = new DataTransfer();
    clipboard.setData('text/html', '<p onclick="window.__unsafePaste=true" style="color: rgb(220, 38, 38); font-weight: 700; position: fixed; z-index: 999999">Rich <em>Text</em><a href="javascript:window.__unsafePaste=true">Link</a><script>window.__unsafePaste=true</script></p>');
    clipboard.setData('text/plain', 'Rich Text');
    editor.dispatchEvent(new ClipboardEvent('paste', {clipboardData: clipboard, bubbles: true, cancelable: true}));
    await new Promise(resolve => setTimeout(resolve, 100));
    const dialog = document.querySelector('[role="dialog"]');
    const keep = Array.from(dialog.querySelectorAll('button')).find(button => button.textContent.includes('Formatierung beibehalten'));
    keep.click();
    await new Promise(resolve => setTimeout(resolve, 50));
    return {html: editor.innerHTML, unsafe: window.__unsafePaste === true, dialogClosed: !document.querySelector('[role="dialog"]')};
  })()`);

  const plain = await compose.evaluate(`(async () => {
    const editor = document.querySelector('[contenteditable]');
    editor.focus();
    const clipboard = new DataTransfer();
    clipboard.setData('text/html', '<strong style="color: blue">Plain choice</strong>');
    clipboard.setData('text/plain', 'Plain choice');
    editor.dispatchEvent(new ClipboardEvent('paste', {clipboardData: clipboard, bubbles: true, cancelable: true}));
    await new Promise(resolve => setTimeout(resolve, 100));
    const dialog = document.querySelector('[role="dialog"]');
    const plainButton = Array.from(dialog.querySelectorAll('button')).find(button => button.textContent.includes('Nur Text'));
    plainButton.click();
    return {html: editor.innerHTML, text: editor.textContent};
  })()`);

  const formattedValue = formatted.result.value;
  const plainValue = plain.result.value;
  const passed = formattedValue.html.includes('rgb(220, 38, 38)')
    && formattedValue.html.includes('<em')
    && !formattedValue.html.includes('<script')
    && !formattedValue.html.includes('javascript:')
    && !formattedValue.html.includes('position: fixed')
    && !formattedValue.html.includes('onclick=')
    && !formattedValue.unsafe
    && formattedValue.dialogClosed
    && plainValue.text.endsWith('Plain choice')
    && !plainValue.html.includes('<strong style="color: blue">Plain choice</strong>');

  await compose.evaluate('window.uniqueMailNative.dockDetachedCompose({to:"",cc:"",bcc:"",subject:"",body:"",attachments:[]})');
  compose.close();
  main.close();
  console.log(JSON.stringify({ passed, formatted: formattedValue, plain: plainValue }, null, 2));
  if (!passed) process.exitCode = 1;
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
