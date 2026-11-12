/* Personal health sync: a separate auth session, per-account caches and optimistic writes. */
(function () {
  'use strict';
  const core = window.HealthSyncCore;
  const anonymousKey = 'healthPlan12w_v1', ownerKey = anonymousKey + ':linked-owner';
  let session = null, identity, epoch = 0, busy = false, again = false, timer;
  let base = {}, revision = 0, conflictRemote = null, applying = false, signingOut = false;
  const originalSave = saveState;
  const status = $('cloudStatus'), account = $('cloudAccount');
  const read = (key, fallback) => {try {return JSON.parse(localStorage.getItem(key)) ?? fallback} catch {return fallback}};
  const message = text => {status.textContent = text};
  const validate = data => Object.keys(data || {}).length ? core.clean(validateBackup(data)) : {};
  function persistMeta() {
    localStorage.setItem(STORAGE_KEY + ':sync', JSON.stringify({base, revision}));
  }
  function render() {
    const oldDate = $('startDate').value;
    document.querySelectorAll('input,textarea,select').forEach(el => {
      if (el.dataset.save) el.checked = !!state[recordKey(el.dataset.save)];
      else if (el.dataset.track) {
        const key = el.dataset.track + '_' + el.dataset.key;
        if (el !== document.activeElement) el.value = state[key] ?? '';
      } else if (['startDate','baseWeight','baseWaist','baseBodyfat','baseMuscle','selectedWeek'].includes(el.id)) {
        if (el !== document.activeElement) el.value = state[el.id] ?? el.defaultValue ?? '1';
      }
    });
    if (oldDate !== $('startDate').value) refreshDates();
    if (document.activeElement !== $('weeklyNotes')) $('weeklyNotes').value = state[recordKey('weeklyNotes')] || '';
    updateProgress();
  }
  function apply(next) {
    const selectedWeek = String(currentWeek());
    state = {...next, selectedWeek};
    applying = true;
    try {if (!originalSave()) throw Error('本机存储不可用，请导出备份后再同步。');render()}
    finally {applying = false}
  }
  function queue(delay = 900) {
    clearTimeout(timer);
    if (signingOut) return;
    if (!session) {message('未登录 · 记录仅保存在当前浏览器');return}
    if (conflictRemote) {message('发现冲突，请先选择保留哪一份记录');return}
    if (!navigator.onLine) {message('当前离线 · 修改已保存在本机，联网后自动同步');return}
    message('本机已保存 · 等待同步');
    timer = setTimeout(() => synchronize(), delay);
  }
  saveState = function () {
    const saved = originalSave();
    if (saved && !applying) queue();
    return saved;
  };
  function displayConflict(remote) {
    conflictRemote = remote;
    const merged = core.merge(base, core.clean(state), remote.state);
    $('cloudConflicts').hidden = false;
    const label = key => {
      const weekly = key.match(/^weeklog_(\d+)_(.+)$/), field = weekly ? weekly[2] : key;
      const check = [...document.querySelectorAll('[data-save]')].find(el => el.dataset.save === field);
      const tracking = [...document.querySelectorAll('[data-track]')].find(el => el.dataset.track + '_' + el.dataset.key === field);
      const names = {startDate:'计划开始日期',baseWeight:'基线体重',baseWaist:'基线腰围',baseBodyfat:'基线体脂率',baseMuscle:'基线骨骼肌量',weeklyNotes:'总结与调整'};
      return (weekly ? `第${weekly[1]}周 · ` : '') + (names[field] || tracking?.getAttribute('aria-label') || check?.parentElement.textContent.trim() || field);
    };
    const value = item => item === undefined ? '未填写' : item === true ? '已完成' : item === false ? '未完成' : String(item).slice(0,160) || '空白';
    const details = merged.conflicts.map(key => `${label(key)}\n本机：${value(state[key])}\n云端：${value(remote.state[key])}`).join('\n\n');
    $('cloudConflictDetails').textContent = `有 ${merged.conflicts.length} 项在两台设备上分别修改。其他项目会自动合并。\n\n${details}`;
    message('同步暂停 · 有记录需要你选择');
  }
  async function chooseConflict(useRemote) {
    const remote = conflictRemote;if (!remote || !session) return;
    const resolved = core.resolve(base, core.clean(state), remote.state, useRemote);
    try {
      apply(resolved);base = remote.state;revision = remote.revision;persistMeta();
      conflictRemote = null;$('cloudConflicts').hidden = true;queue(0);
    } catch (error) {message(error.message)}
  }
  const client = window.supabase?.createClient('https://rpswfigfnseofehxkfie.supabase.co',
    'sb_publishable_LnoBI1cTWU9g5s2MZNtFng_Uffo24E7', {
      auth: {persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'health-plan-12weeks-auth-v1'}
    });
  async function synchronize() {
    if (!client || !session || conflictRemote || signingOut) return;
    if (!navigator.onLine) {message('当前离线 · 联网后自动同步');return}
    if (busy) {again = true;return}
    busy = true;again = false;
    const runEpoch = epoch, userId = session.user.id;
    const active = () => epoch === runEpoch && session?.user.id === userId && !signingOut;
    message('正在同步…');
    try {
      const {data, error} = await client.from('health_plan_states').select('state,revision,updated_at').eq('user_id',userId).maybeSingle();
      if (!active()) return;
      if (error) throw error;
      let remote = data ? {...data,state:validate(data.state)} : {state:{},revision:0};
      // Retry races with another device; only the server's revision can authorize a write.
      for (let attempt = 0;attempt < 4;attempt++) {
        if (!active()) return;
        const merged = core.merge(base, core.clean(state), remote.state);
        if (merged.conflicts.length) {displayConflict(remote);return}
        apply(merged.state);
        base = remote.state;revision = remote.revision;persistMeta();
        const outgoing = core.clean(state);
        if (core.same(outgoing, remote.state)) {message('已同步 · ' + new Date().toLocaleTimeString());return}
        const result = await client.rpc('save_health_plan', {p_expected_revision:revision,p_state:outgoing});
        if (!active()) return;
        if (result.error) throw result.error;
        remote = {...result.data,state:validate(result.data.state)};
        if (!result.data.saved) continue;
        // Edits typed during the request remain dirty and will be sent in the next pass.
        base = remote.state;revision = remote.revision;persistMeta();
        if (core.same(core.clean(state),outgoing)) message('已同步 · ' + new Date().toLocaleTimeString());
        else {again = true;message('本机有新修改 · 继续同步')}
        return;
      }
      again = true;message('另一台设备也在更新，稍后自动重试');
    } catch (error) {
      if (!active()) return;
      if (['42P01','PGRST205','PGRST202','42883'].includes(error.code)) message('云端尚未完成配置 · 本机记录已保留');
      else if (error.status === 401 || error.code === 'PGRST301') message('登录已过期，请重新登录；本机记录已保留');
      else message('同步未完成 · 本机记录已保留，可点“立即同步”重试');
    } finally {
      busy = false;
      if (again && !conflictRemote && !signingOut) queue(1200);
    }
  }
  async function useSession(next) {
    const nextId = next?.user.id || null;
    if (identity === nextId) {session = next;return}
    epoch++;clearTimeout(timer);session = next;identity = nextId;
    conflictRemote = null;$('cloudConflicts').hidden = true;
    try {
      if (nextId) {
        const unlinked = core.clean(state);
        STORAGE_KEY = anonymousKey + ':user:' + nextId;
        const cached = read(STORAGE_KEY, null);
        const owner = localStorage.getItem(ownerKey);
        state = cached || (!owner ? unlinked : {});
        const metadata = read(STORAGE_KEY + ':sync', {});
        base = validate(metadata.base || {});revision = Number(metadata.revision) || 0;
        if (!originalSave()) throw Error('本机存储不可用，请先备份记录。');
        if (!owner) {localStorage.setItem(ownerKey,nextId);localStorage.removeItem(anonymousKey)}
        $('selectedWeek').value = String(currentWeek());render();
        account.textContent = '已登录：' + next.user.email;
        $('cloudLogin').hidden = true;$('cloudSignedIn').hidden = false;
        queue(0);
      } else {
        STORAGE_KEY = anonymousKey;
        state = loadState();
        base = {};revision = 0;render();
        account.textContent = '用同一个邮箱登录，即可在手机与电脑之间同步。';
        $('cloudLogin').hidden = false;$('cloudSignedIn').hidden = true;
        message('未登录 · 记录仅保存在当前浏览器');
      }
    } catch (error) {message('无法载入账号记录：' + error.message)}
  }
  $('cloudSendCode').addEventListener('click', async () => {
    const email = $('cloudEmail').value.trim();
    if (!$('cloudEmail').reportValidity() || !email) return;
    if (!client) {message('登录组件未加载，请刷新重试');return}
    $('cloudSendCode').disabled = true;message('正在发送登录邮件…');
    try {
      const {error} = await client.auth.signInWithOtp({email, options:{shouldCreateUser:true,emailRedirectTo:'https://chichao777.github.io/health-plan-12weeks/'}});
      if (error) throw error;
      message('登录邮件已发送：输入邮件里的验证码，或在当前设备打开登录链接。');
      setTimeout(() => $('cloudSendCode').disabled = false,60000);
    } catch {message('邮件发送失败，请检查邮箱地址或稍后重试');$('cloudSendCode').disabled = false}
  });
  $('cloudVerify').addEventListener('click', async () => {
    const email = $('cloudEmail').value.trim(), token = $('cloudCode').value.trim();
    if (!client || !email || !token) {message('请先填写邮箱和邮件中的验证码');return}
    $('cloudVerify').disabled = true;
    try {
      const {error} = await client.auth.verifyOtp({email,token,type:'email'});
      if (error) throw error;
      $('cloudCode').value = '';
    } catch {message('验证码无效或已过期，请检查或重新发送')}
    finally {$('cloudVerify').disabled = false}
  });
  $('cloudVerifyLink').addEventListener('click', async () => {
    if (!client) {message('登录组件未加载，请刷新重试');return}
    try {
      const url = new URL($('cloudMagicLink').value.trim());
      if (url.origin !== 'https://rpswfigfnseofehxkfie.supabase.co' || url.pathname !== '/auth/v1/verify' ||
          !['email','magiclink','signup'].includes(url.searchParams.get('type'))) throw Error('invalid link');
      const token_hash = url.searchParams.get('token') || url.searchParams.get('token_hash');
      if (!token_hash) throw Error('missing token');
      $('cloudVerifyLink').disabled = true;
      const {error} = await client.auth.verifyOtp({token_hash,type:'email'});
      if (error) throw error;
      $('cloudMagicLink').value = '';
    } catch {message('登录链接无效或已过期，请复制邮件中的完整登录链接，或重新发送邮件')}
    finally {$('cloudVerifyLink').disabled = false}
  });
  $('cloudSyncNow').addEventListener('click', () => synchronize());
  $('cloudKeepLocal').addEventListener('click', () => chooseConflict(false));
  $('cloudKeepRemote').addEventListener('click', () => chooseConflict(true));
  $('cloudSignOut').addEventListener('click', async () => {
    if (!client) return;
    signingOut = true;clearTimeout(timer);
    const dirty = !core.same(core.clean(state),base);
    if (dirty && !confirm('还有未同步的记录，退出后仍保存在本机账号缓存中。确定退出？')) {signingOut=false;queue();return}
    epoch++;
    const {error} = await client.auth.signOut({scope:'local'});
    signingOut = false;
    if (error) {message('退出未完成，请重试');return}
    await useSession(null);
  });
  $('resetBtn').addEventListener('click', async event => {
    if (!session) return;
    event.stopImmediatePropagation();
    if (!confirm('仅清空此设备的账号缓存并退出登录，云端记录会保留。下次登录将重新下载云端记录。确定继续？')) return;
    const cacheKey = STORAGE_KEY;
    signingOut = true;epoch++;clearTimeout(timer);
    const {error} = await client.auth.signOut({scope:'local'});
    signingOut = false;
    if (error) {message('退出未完成，未清空本机记录');return}
    try {localStorage.removeItem(cacheKey);localStorage.removeItem(cacheKey + ':sync');location.reload()}
    catch {message('无法清空本机缓存，请重试')}
  }, true);
  window.addEventListener('online', () => queue(0));
  window.addEventListener('offline', () => message('当前离线 · 修改保存在本机，联网后自动同步'));
  window.addEventListener('focus', () => {if (session) queue(200)});
  document.addEventListener('visibilitychange', () => {if (!document.hidden && session) queue(100)});
  window.addEventListener('beforeunload', event => {
    if (session && !core.same(core.clean(state),base)) {event.preventDefault();event.returnValue=''}
  });
  setInterval(() => {if (session && !document.hidden) synchronize()},15000);
  if (client) {
    client.auth.onAuthStateChange((_event,next) => {setTimeout(() => useSession(next),0)});
    client.auth.getSession().then(({data,error}) => {if (error) message('无法恢复登录，请重新登录');else useSession(data.session)});
  } else message('云端登录组件未加载 · 本机记录功能仍可使用');
})();
