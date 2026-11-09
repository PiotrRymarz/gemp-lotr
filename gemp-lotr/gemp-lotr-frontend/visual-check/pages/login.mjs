// The login page: the legacy index.html and the Angular page at /gemp-lotr/ng/login. The server's status line comes
// from src/testing/server-responses; a scenario's own answers stand in for POST /login.

const LEGACY = {
  register: '.interaction > .ui-button >> nth=0',
  login: '#login',
  password: '#password',
  submit: '.interaction > .ui-button >> nth=1', // after Register
};
const ANGULAR = {
  register: '.gd-login [data-action="register"]',
  login: '.gd-login__input[name="login"]',
  password: '.gd-login__input[name="password"]',
  submit: '.gd-login [data-action="submit"]',
};
const controls = (which) => (which === 'legacy' ? LEGACY : ANGULAR);

/** Types a login and password and presses the form's Login button. */
async function logIn(page, which) {
  const c = controls(which);
  await page.fill(c.login, 'frodo');
  await page.fill(c.password, 'ring');
  await page.click(c.submit);
}

export default {
  name: 'login',
  legacy: '/gemp-lotr/index.html',
  angular: '/gemp-lotr/ng/login',
  answer(path) {
    if (path === '/') return { file: 'server-status.txt', type: 'text/plain' };
    if (path === '/player') return { status: 401 }; // nobody logged in yet (the shell asks)
    if (path === '/login' || path === '/register') return { file: 'login-ok.xml' };
    return null;
  },
  scenarios: [
    { name: 'initial', act: async () => {} },
    { name: 'register', act: (page, which) => page.click(controls(which).register) },
    { name: 'error', answers: { '/login': { status: 401 } }, act: logIn },
    // The answer never comes: the page stays busy. Angular only: the legacy login call was synchronous (the page froze
    // until the answer), so its side is shown as loaded
    { name: 'busy', angularOnly: true, pending: true, answers: { '/login': { hang: true } }, act: logIn },
  ],
};
