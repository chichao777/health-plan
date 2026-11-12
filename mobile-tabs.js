(function () {
  'use strict';
  const nav = document.getElementById('bottomNav');
  const buttons = [...nav.querySelectorAll('[data-view]')];
  const panels = [...document.querySelectorAll('[data-page]')];
  const routes = {profile:'overview',training:'training',nutrition:'nutrition',tracker:'tracker',weekly:'weekly'};
  const positions = {};
  let active = null;
  function activate(view, {anchor = null, remember = true} = {}) {
    if (!Object.hasOwn(routes,view)) view = 'profile';
    if (active && remember) positions[active] = window.scrollY;
    active = view;
    document.body.dataset.activePage = view;
    for (const panel of panels) panel.hidden = panel.dataset.page !== view;
    for (const button of buttons) {
      if (button.dataset.view === view) button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    }
    requestAnimationFrame(() => {
      if (anchor) {
        const target=document.getElementById(anchor), details=target?.closest('details');
        if(details)details.open=true;
        target?.scrollIntoView({block:'start',behavior:'instant'});
      }
      else window.scrollTo({top:positions[view] || 0,behavior:'instant'});
    });
  }
  function followHash(initial = false) {
    const hash = window.location.hash.slice(1);
    if(hash==='cloudSync'){
      if(!active)activate('profile');
      window.dispatchEvent(new Event('open-health-sync'));return;
    }
    const target = document.getElementById(hash);
    const panel = target?.closest('[data-page]');
    if (panel) activate(panel.dataset.page, {anchor:initial && Object.values(routes).includes(hash) ? null : hash});
    else activate('profile');
  }
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const view = button.dataset.view;
      if (view === active) return;
      history.pushState(null,'','#' + routes[view]);
      activate(view);
    });
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const index = buttons.indexOf(button);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length-1 :
        (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();buttons[next].click();
    });
  }
  window.addEventListener('hashchange', () => followHash());
  // Show conflicts even if the user is currently reading a different view.
  const conflicts = document.getElementById('cloudConflicts');
  new MutationObserver(() => {
    if (!conflicts.hidden) window.dispatchEvent(new Event('open-health-sync'));
  }).observe(conflicts,{attributes:true,attributeFilter:['hidden']});
  document.body.classList.add('has-tabs');nav.hidden = false;followHash(true);
})();
