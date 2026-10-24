/* ==========================================================================
   Aquamarine · 动画手帖 — interactions
   ========================================================================== */
(() => {
  'use strict';

  const DATA = window.AQUAMARINE;
  if (!DATA) {
    console.error('AQUAMARINE data is missing.');
    return;
  }

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const root = document.documentElement;
  const body = document.body;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  const statusLabels = { 1: '想看', 2: '看过', 3: '在看', 4: '搁置', 5: '抛弃' };
  const statusOrder = [
    { key: 'all', label: '全部' },
    { key: '2', label: '看过' },
    { key: '3', label: '在看' },
    { key: '1', label: '想看' },
    { key: '4', label: '搁置' }
  ];

  /* ---------- Theme ---------- */
  const themeToggle = $('#themeToggle');
  const themeLabel = $('#themeLabel');
  const metaTheme = document.querySelector('meta[name="theme-color"]');

  function applyTheme(theme, persist = false) {
    const next = theme === 'night' ? 'night' : 'light';
    root.dataset.theme = next;
    root.style.colorScheme = next;
    if (metaTheme) metaTheme.content = next === 'night' ? '#06191c' : '#f4f1e8';
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', String(next === 'night'));
      themeToggle.setAttribute('aria-label', next === 'night' ? '切换到日间模式' : '切换到夜间模式');
    }
    if (themeLabel) themeLabel.textContent = next === 'night' ? '日间' : '夜航';
    if (persist) {
      try { localStorage.setItem('aquamarine-theme', next); } catch (e) { /* no-op */ }
    }
  }

  let savedTheme = null;
  try { savedTheme = localStorage.getItem('aquamarine-theme'); } catch (e) { /* no-op */ }
  applyTheme(savedTheme || 'light', false);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      applyTheme(root.dataset.theme === 'night' ? 'light' : 'night', true);
    });
  }

  /* ---------- Header, progress, back to top ---------- */
  const header = $('#siteHeader');
  const progressBar = $('#progressBar');
  const backTop = $('#backTop');
  const navLinks = $$('.main-nav a');
  const sections = $$('main section[id]');
  let scrollQueued = false;

  function updateScrollUI() {
    const y = window.scrollY;
    header?.classList.toggle('is-scrolled', y > 20);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progressBar) progressBar.style.width = max > 0 ? `${Math.min(100, (y / max) * 100)}%` : '0%';
    backTop?.classList.toggle('is-visible', y > 760);

    let active = '';
    const probe = y + 150;
    sections.forEach((section) => {
      if (section.offsetTop <= probe) active = section.id;
    });
    navLinks.forEach((link) => {
      const on = link.getAttribute('href') === `#${active}`;
      link.classList.toggle('is-active', on);
      if (on) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    scrollQueued = false;
  }

  function requestScrollUI() {
    if (!scrollQueued) {
      scrollQueued = true;
      requestAnimationFrame(updateScrollUI);
    }
  }

  window.addEventListener('scroll', requestScrollUI, { passive: true });
  window.addEventListener('resize', requestScrollUI);
  updateScrollUI();

  backTop?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* ---------- Mobile menu ---------- */
  const menuToggle = $('#menuToggle');
  const mobileMenu = $('#mobileMenu');

  function setMenu(open) {
    if (!menuToggle || !mobileMenu) return;
    mobileMenu.classList.toggle('is-open', open);
    mobileMenu.setAttribute('aria-hidden', String(!open));
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
    body.classList.toggle('menu-open', open);
  }

  menuToggle?.addEventListener('click', () => {
    setMenu(menuToggle.getAttribute('aria-expanded') !== 'true');
  });
  if (mobileMenu) {
    $$('a', mobileMenu).forEach((link) => {
      link.addEventListener('click', () => setMenu(false));
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mobileMenu?.classList.contains('is-open')) setMenu(false);
  });

  /* ---------- Hero spotlight + float parallax ---------- */
  const hero = $('.hero');
  const heroBg = $('.hero-bg');
  const floatCards = $$('.float-card');
  let heroQueued = false;
  let heroPointer = { x: 0, y: 0 };

  function updateHeroFx() {
    if (!heroBg) return;
    heroBg.style.setProperty('--mx', `${heroPointer.x}%`);
    heroBg.style.setProperty('--my', `${heroPointer.y}%`);
    floatCards.forEach((card) => {
      const depth = Number(card.dataset.depth || 14);
      card.style.setProperty('--tx', `${(heroPointer.x - 50) / 50 * depth}px`);
      card.style.setProperty('--ty', `${(heroPointer.y - 50) / 50 * depth}px`);
    });
    heroQueued = false;
  }

  if (hero && !reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    hero.addEventListener('pointermove', (event) => {
      const rect = hero.getBoundingClientRect();
      heroPointer = {
        x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
        y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
      };
      if (!heroQueued) {
        heroQueued = true;
        requestAnimationFrame(updateHeroFx);
      }
    }, { passive: true });
    hero.addEventListener('pointerleave', () => {
      heroPointer = { x: 50, y: 50 };
      requestAnimationFrame(updateHeroFx);
    });
  }

  /* ---------- Tag cloud ---------- */
  const tagAliases = {
    '轻百合': ['轻百合', '轻百'],
    '京阿尼': ['京阿尼', '京都动画', '京都アニメーション', 'Kyoto Animation'],
    'SILVER LINK.': ['SILVERLINK.', 'SILVER_LINK.', 'SILVER LINK.', 'SILVER LINK'],
    'Type-Moon': ['Type-Moon', '型月'],
    '物语系列': ['物语系列', '物语'],
    '水星领航员': ['水星领航员', 'ARIA', 'アリア'],
    'LoveLive!': ['LoveLive', 'LoveLive!', 'LoveLive！', 'ラブライブ'],
    '苍树梅': ['苍树梅', '蒼樹うめ'],
    '花泽香菜': ['花泽香菜', '花澤香菜'],
    '佐藤顺一': ['佐藤顺一', '佐藤順一'],
    '花田十辉': ['花田十辉', '花田十輝'],
    '梶浦由记': ['梶浦由记', '梶浦由記', '梶浦由紀', '梶浦'],
    '西尾维新': ['西尾维新', '西尾維新'],
    'Studio五组': ['Studio五组', 'Studio五組', 'Studio 五组'],
    'Hal Film Maker': ['Hal Film Maker', 'HalFilmMaker', 'HAL_FILM_MAKER'],
    '幸运星': ['幸运星', 'らき☆すた'],
    '轻音少女': ['轻音少女', 'けいおん'],
    '凉宫春日': ['凉宫春日', '涼宮ハルビ', '涼宮ハルヒ'],
    '动画工房': ['动画工房', '動画工房']
  };

  function matchesTag(item, tag) {
    const aliases = tagAliases[tag] || [tag];
    const haystack = ` ${item.search} `;
    return aliases.some((alias) => haystack.includes(` ${alias.toLowerCase()} `));
  }

  const tagCloud = $('#tagCloud');
  if (tagCloud) {
    DATA.tagCloud.forEach((tag) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tag';
      button.dataset.w = tag.w;
      button.dataset.freq = tag.count;
      button.textContent = tag.name;
      button.title = `${tag.name} · 出现在 ${tag.count} 部看过的动画里`;
      button.setAttribute('aria-label', `${tag.name}，出现在 ${tag.count} 部看过的动画里，点击筛选书架`);
      button.addEventListener('click', () => applyTag(tag.name));
      tagCloud.appendChild(button);
    });
  }

  /* ---------- Taste bars ---------- */
  const tasteBars = $('#tasteBars');
  if (tasteBars) {
    DATA.bars.forEach((bar) => {
      const row = document.createElement('div');
      row.className = 'bar-row';
      row.innerHTML = `
        <span>${esc(bar.label)}</span>
        <span class="bar-track"><span class="bar-fill" style="--pct:${bar.pct}%"></span></span>
        <span class="bar-count">${bar.count}</span>`;
      tasteBars.appendChild(row);
    });
  }

  /* ---------- Featured cards ---------- */
  const lovesGrid = $('#lovesGrid');
  if (lovesGrid) {
    DATA.featured.forEach((item, index) => {
      const full = DATA.items.find((entry) => entry.id === item.id) || {};
      const format = full.total === 1 ? '剧场版' : (full.total ? 'TV' : '动画');
      const article = document.createElement('article');
      article.className = 'love-card';
      article.dataset.id = item.id;
      article.tabIndex = 0;
      article.setAttribute('role', 'button');
      article.setAttribute('aria-label', `查看《${item.name}》的详情`);
      article.innerHTML = `
        <div class="love-cover">
          <img src="${esc(item.cover)}" alt="《${esc(item.name)}》封面" loading="lazy" width="300" height="380">
          <span class="love-num">${String(index + 1).padStart(2, '0')}</span>
          <span class="love-rate">${item.rate || '—'}</span>
        </div>
        <div class="love-body">
          <p class="love-year">${item.year || '—'} · ${format}</p>
          <h3>${esc(item.name)}</h3>
          <p class="love-quote">“${esc(item.quote)}”</p>
          <p class="love-source">${esc(item.source)}</p>
        </div>`;
      article.addEventListener('click', () => openModal(item.id));
      article.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openModal(item.id);
        }
      });
      lovesGrid.appendChild(article);
    });
  }

  /* ---------- Archive state ---------- */
  const state = {
    status: '2',
    cat: 'all',
    tag: null,
    query: '',
    sort: 'rating',
    shown: 36
  };

  const statusTabs = $('#statusTabs');
  const filterRow = $('#filterRow');
  const workGrid = $('#workGrid');
  const archiveCount = $('#archiveCount');
  const loadMore = $('#loadMore');
  const loadNote = $('#loadNote');
  const clearFilters = $('#clearFilters');
  const searchInput = $('#searchInput');
  const sortSelect = $('#sortSelect');
  const randomBtn = $('#randomBtn');

  const statusCounts = DATA.items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  function renderStatusTabs() {
    if (!statusTabs) return;
    statusTabs.innerHTML = statusOrder.map((entry) => {
      const count = entry.key === 'all' ? DATA.items.length : (statusCounts[entry.key] || 0);
      const active = state.status === entry.key;
      return `<button class="status-tab${active ? ' is-active' : ''}" type="button" aria-pressed="${active}" data-status="${entry.key}">${entry.label}<span>${count}</span></button>`;
    }).join('');
    $$('.status-tab', statusTabs).forEach((button) => {
      button.addEventListener('click', () => {
        state.status = button.dataset.status;
        state.tag = null;
        state.shown = 36;
        renderStatusTabs();
        renderFilterChips();
        renderArchive();
      });
    });
  }

  function renderFilterChips() {
    if (!filterRow) return;
    filterRow.innerHTML = DATA.filters.map((filter) => {
      const pool = state.status === 'all'
        ? DATA.items
        : DATA.items.filter((item) => String(item.status) === state.status);
      const count = filter.key === 'all'
        ? pool.length
        : pool.filter((item) => item.cats.includes(filter.key)).length;
      const active = state.cat === filter.key;
      return `<button class="filter-chip${active ? ' is-active' : ''}" type="button" data-cat="${filter.key}">${esc(filter.label)}<span>${count}</span></button>`;
    }).join('');
    $$('.filter-chip', filterRow).forEach((button) => {
      button.addEventListener('click', () => {
        state.cat = button.dataset.cat;
        state.tag = null;
        state.shown = 36;
        renderFilterChips();
        renderArchive();
      });
    });
  }

  function matchesState(item) {
    if (state.status !== 'all' && String(item.status) !== state.status) return false;
    if (state.cat !== 'all' && !item.cats.includes(state.cat)) return false;
    if (state.tag && !matchesTag(item, state.tag)) return false;
    if (state.query) {
      const q = state.query.toLowerCase();
      if (!item.search.includes(q)) return false;
    }
    return true;
  }

  const collator = new Intl.Collator('zh-Hans-CN', { sensitivity: 'base' });

  function getFiltered() {
    const list = DATA.items.filter(matchesState);
    list.sort((a, b) => {
      if (state.sort === 'updated') return String(b.updated).localeCompare(String(a.updated));
      if (state.sort === 'year') return (b.year - a.year) || (b.rate - a.rate);
      if (state.sort === 'title') return collator.compare(a.cn, b.cn);
      return (b.rate - a.rate) || (b.year - a.year) || collator.compare(a.cn, b.cn);
    });
    return list;
  }

  function workCard(item) {
    const statusBadge = item.status !== 2
      ? `<span class="work-status">${statusLabels[item.status] || ''}</span>`
      : '';
    const rateBadge = item.rate
      ? `<span class="work-badge r${item.rate}">${item.rate}</span>`
      : '';
    const epLabel = item.total === 1 ? '剧场版' : (item.total ? `${item.eps || 0} / ${item.total} 话` : 'OVA');
    return `
      <article class="work">
        <div class="work-open" role="button" tabindex="0" data-id="${item.id}" aria-label="查看《${esc(item.cn)}》详情">
          <span class="work-cover">
            <img src="${esc(item.cover)}" alt="《${esc(item.cn)}》封面" loading="lazy" width="300" height="415">
            ${rateBadge}
            ${statusBadge}
            <span class="work-overlay"><span>VIEW DETAIL</span><span aria-hidden="true">↗</span></span>
          </span>
          <h3 class="work-title">${esc(item.cn)}</h3>
          <p class="work-meta">${item.year || '—'} · ${epLabel}</p>
        </div>
      </article>`;
  }

  function renderArchive() {
    if (!workGrid) return;
    const filtered = getFiltered();
    const total = filtered.length;
    if (state.shown < 36) state.shown = 36;
    const visible = filtered.slice(0, state.shown);

    if (!total) {
      workGrid.innerHTML = `
        <div class="empty-state">
          <strong>这片海里暂时没有。</strong>
          <span>换一个关键词，或者清除筛选再看看。</span>
        </div>`;
    } else {
      workGrid.innerHTML = visible.map(workCard).join('');
    }

    if (archiveCount) {
      if (!total) archiveCount.textContent = '没有找到';
      else if (state.tag) archiveCount.textContent = `标签「${state.tag}」 · ${total} 部`;
      else archiveCount.textContent = `显示 ${Math.min(state.shown, total)} / ${total} 部`;
    }

    if (loadMore) {
      const remaining = total - state.shown;
      loadMore.hidden = remaining <= 0 || total === 0;
      loadMore.innerHTML = `继续下潜 · 还有 ${remaining} 部 <span aria-hidden="true">↓</span>`;
    }
    if (loadNote) {
      loadNote.textContent = total
        ? `按「${sortSelect?.selectedOptions?.[0]?.textContent || '我的评分'}」排序 · 共 ${total} 部`
        : '试试「日常」「百合」或「京都动画」';
    }
    if (clearFilters) {
      const active = state.status !== '2' || state.cat !== 'all' || state.tag || state.query;
      clearFilters.classList.toggle('is-visible', Boolean(active));
    }
    if (statusTabs) {
      $$('.status-tab', statusTabs).forEach((button) => {
        const on = button.dataset.status === state.status;
        button.classList.toggle('is-active', on);
        button.setAttribute('aria-pressed', String(on));
      });
    }
    if (filterRow) {
      $$('.filter-chip', filterRow).forEach((button) => {
        button.classList.toggle('is-active', button.dataset.cat === state.cat);
      });
    }
  }

  function applyTag(tag) {
    state.tag = tag;
    state.query = '';
    state.status = '2';
    state.cat = 'all';
    state.shown = 36;
    if (searchInput) searchInput.value = '';
    renderStatusTabs();
    renderFilterChips();
    renderArchive();
    const archive = $('#archive');
    if (archive) {
      const top = archive.getBoundingClientRect().top + window.scrollY - 74;
      window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }

  workGrid?.addEventListener('click', (event) => {
    const button = event.target.closest('.work-open');
    if (button) openModal(Number(button.dataset.id));
  });
  workGrid?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const button = event.target.closest('.work-open');
    if (!button) return;
    event.preventDefault();
    openModal(Number(button.dataset.id));
  });

  loadMore?.addEventListener('click', () => {
    state.shown += 36;
    renderArchive();
  });

  clearFilters?.addEventListener('click', () => {
    state.status = '2';
    state.cat = 'all';
    state.tag = null;
    state.query = '';
    state.shown = 36;
    if (searchInput) searchInput.value = '';
    renderStatusTabs();
    renderFilterChips();
    renderArchive();
  });

  let searchTimer = 0;
  searchInput?.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.query = searchInput.value.trim();
      state.tag = null;
      state.shown = 36;
      renderArchive();
    }, 140);
  });

  sortSelect?.addEventListener('change', () => {
    state.sort = sortSelect.value;
    state.shown = 36;
    renderArchive();
  });

  randomBtn?.addEventListener('click', () => {
    const pool = getFiltered();
    if (!pool.length) return;
    const item = pool[Math.floor(Math.random() * pool.length)];
    openModal(item.id);
  });

  renderStatusTabs();
  renderFilterChips();
  renderArchive();

  /* ---------- Modal ---------- */
  const modal = $('#workModal');
  const modalCover = $('#modalCover');
  const modalRate = $('#modalRate');
  const modalTitle = $('#modalTitle');
  const modalJp = $('#modalJp');
  const modalKicker = $('#modalKicker');
  const modalMeta = $('#modalMeta');
  const modalTags = $('#modalTags');
  const modalSummary = $('#modalSummary');
  const modalComment = $('#modalComment');
  const modalCommunity = $('#modalCommunity');
  const modalLink = $('#modalLink');
  const modalClose = $('#modalClose');
  let lastTrigger = null;

  function openModal(id) {
    if (!modal) return;
    const item = DATA.items.find((entry) => entry.id === id);
    if (!item) return;
    lastTrigger = document.activeElement;

    if (modalCover) {
      modalCover.src = item.cover;
      modalCover.alt = `《${item.cn}》封面`;
    }
    if (modalRate) {
      if (item.rate) {
        modalRate.hidden = false;
        modalRate.textContent = item.rate;
      } else {
        modalRate.hidden = true;
      }
    }
    if (modalTitle) modalTitle.textContent = item.cn;
    if (modalJp) modalJp.textContent = item.name;
    if (modalKicker) modalKicker.textContent = `BANGUMI COLLECTION / ${item.year || '—'}`;
    if (modalMeta) {
      const meta = [
        item.date || '',
        item.total === 1 ? '剧场版' : (item.total ? `${item.eps || 0} / ${item.total} 话` : 'OVA'),
        item.rate ? `我的评分 ${item.rate} / 10` : '还未评分',
        statusLabels[item.status] || ''
      ].filter(Boolean);
      modalMeta.innerHTML = meta.map((text) => `<span>${esc(text)}</span>`).join('');
    }
    if (modalTags) {
      modalTags.innerHTML = item.tags.slice(0, 8).map((tag) => `<span>${esc(tag)}</span>`).join('');
    }
    if (modalSummary) {
      modalSummary.textContent = item.summary || '';
      modalSummary.hidden = !item.summary;
    }
    if (modalComment) {
      modalComment.textContent = item.comment ? `“${item.comment}”` : '';
      modalComment.classList.toggle('is-visible', Boolean(item.comment));
    }
    if (modalCommunity) {
      modalCommunity.textContent = item.score
        ? `Bangumi 评分 ${item.score.toFixed(1)}${item.rank ? ` · 排名 #${item.rank}` : ''}`
        : 'Bangumi 暂无评分';
    }
    if (modalLink) modalLink.href = `https://bangumi.tv/subject/${item.id}`;

    if (typeof modal.showModal === 'function') {
      if (!modal.open) modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
    body.classList.add('modal-open');
    window.setTimeout(() => modalClose?.focus(), 30);
  }

  function closeModal() {
    if (!modal) return;
    if (typeof modal.close === 'function' && modal.open) modal.close();
    else modal.removeAttribute('open');
    body.classList.remove('modal-open');
    if (lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus();
  }

  modalClose?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  modal?.addEventListener('close', () => body.classList.remove('modal-open'));
  modal?.addEventListener('cancel', () => body.classList.remove('modal-open'));

  /* ---------- Stats charts ---------- */
  const ratingChart = $('#ratingChart');
  if (ratingChart) {
    const rows = DATA.rating.filter((entry) => entry.r >= 6);
    const max = Math.max(...rows.map((entry) => entry.c), 1);
    ratingChart.innerHTML = rows.map((entry) => {
      const height = Math.max(4, Math.round((entry.c / max) * 172));
      return `
        <div class="rating-col">
          <span class="rating-count">${entry.c}</span>
          <span class="rating-bar" style="--h:${height}px"></span>
          <span class="rating-label">${entry.r}</span>
        </div>`;
    }).join('');
  }

  const yearChart = $('#yearChart');
  if (yearChart) {
    const max = Math.max(...DATA.years.map((entry) => entry.c), 1);
    yearChart.innerHTML = DATA.years.map((entry) => {
      const height = entry.c ? Math.max(3, Math.round((entry.c / max) * 145)) : 1;
      const peak = entry.c === max;
      const label = entry.y % 10 === 0 || entry.y === 1995 || entry.y === 2025
        ? `<span class="year-label">${entry.y}</span>`
        : '';
      return `
        <div class="year-col${peak ? ' is-peak' : ''}" title="${entry.y} 年 · ${entry.c} 部">
          <span class="year-bar" style="--h:${height}px"></span>
          ${label}
        </div>`;
    }).join('');
  }

  const spectrum = $('#spectrum');
  if (spectrum) {
    spectrum.innerHTML = DATA.spectrum.map((entry) =>
      `<span style="--c:${entry.color}" data-id="${entry.id}" title="${esc(entry.title)} · ${entry.color}" aria-hidden="true"></span>`
    ).join('');
    spectrum.addEventListener('click', (event) => {
      const chip = event.target.closest('span[data-id]');
      if (chip) openModal(Number(chip.dataset.id));
    });
  }

  /* ---------- Ring ---------- */
  const ringFg = $('#ringFg');
  if (ringFg) {
    const circumference = 2 * Math.PI * 86;
    const offset = circumference * (1 - DATA.totals.animeRate / 100);
    ringFg.style.strokeDasharray = String(circumference);
    ringFg.style.strokeDashoffset = String(circumference);
    const ringCard = ringFg.closest('.ring-card');
    if (ringCard) {
      const ringObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            window.setTimeout(() => {
              ringFg.style.strokeDashoffset = String(offset);
            }, 120);
            ringObserver.unobserve(entry.target);
          }
        });
      }, { threshold: .35 });
      ringObserver.observe(ringCard);
    }
  }

  /* ---------- Count-up ---------- */
  const countFormatter = new Intl.NumberFormat('en-US');
  function animateCount(el) {
    if (el.dataset.counted === 'true') return;
    el.dataset.counted = 'true';
    const target = Number(el.dataset.count);
    const decimals = Number(el.dataset.decimals || 0);
    if (!Number.isFinite(target)) return;
    if (reduceMotion) {
      el.textContent = decimals ? target.toFixed(decimals) : countFormatter.format(target);
      return;
    }
    const duration = 1350;
    const started = performance.now();
    function frame(now) {
      const p = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const value = target * eased;
      el.textContent = decimals
        ? value.toFixed(decimals)
        : countFormatter.format(Math.round(value));
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = decimals ? target.toFixed(decimals) : countFormatter.format(target);
    }
    requestAnimationFrame(frame);
  }

  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        countObserver.unobserve(entry.target);
      }
    });
  }, { threshold: .5 });
  $$('.hero-stats [data-count], .stats [data-count]').forEach((el) => countObserver.observe(el));

  /* ---------- Reveal ---------- */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: .1, rootMargin: '0px 0px -34px 0px' });
  $$('.reveal').forEach((el) => revealObserver.observe(el));

  /* ---------- Bottles ---------- */
  const bottleForm = $('#bottleForm');
  const bottleText = $('#bottleText');
  const bottleCount = $('#bottleCount');
  const bottleList = $('#bottleList');
  const bottleKey = 'aquamarine-bottles-v1';
  let bottles = [];

  try {
    const raw = localStorage.getItem(bottleKey);
    const parsed = raw ? JSON.parse(raw) : [];
    bottles = Array.isArray(parsed) ? parsed.filter((entry) => entry && entry.text) : [];
  } catch (e) {
    bottles = [];
  }

  function saveBottles() {
    try { localStorage.setItem(bottleKey, JSON.stringify(bottles.slice(0, 20))); } catch (e) { /* no-op */ }
  }

  function bottleDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '刚刚';
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  }

  function renderBottles() {
    if (!bottleList) return;
    if (!bottles.length) {
      bottleList.innerHTML = '<p class="bottle-empty">还没有漂流瓶。写下第一句吧。</p>';
      return;
    }
    bottleList.innerHTML = bottles.map((entry, index) => `
      <div class="bottle-item">
        <p>${esc(entry.text)}</p>
        <time datetime="${esc(entry.date)}">${bottleDate(entry.date)}</time>
        <button class="bottle-delete" type="button" data-index="${index}" aria-label="删除这条留言">×</button>
      </div>`).join('');
  }

  bottleText?.addEventListener('input', () => {
    if (bottleCount) bottleCount.textContent = `${bottleText.value.length} / 120`;
  });

  bottleForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = bottleText?.value.trim();
    if (!text) {
      bottleText?.focus();
      return;
    }
    bottles.unshift({ text, date: new Date().toISOString() });
    bottles = bottles.slice(0, 20);
    saveBottles();
    renderBottles();
    if (bottleText) bottleText.value = '';
    if (bottleCount) bottleCount.textContent = '0 / 120';
    if (bottleList) {
      bottleList.scrollTop = 0;
      const first = bottleList.querySelector('.bottle-item');
      if (first && typeof first.animate === 'function') {
        first.animate(
          [{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }],
          { duration: 380, easing: 'cubic-bezier(.2,.7,.2,1)' }
        );
      }
    }
  });

  bottleList?.addEventListener('click', (event) => {
    const button = event.target.closest('.bottle-delete');
    if (!button) return;
    bottles.splice(Number(button.dataset.index), 1);
    saveBottles();
    renderBottles();
  });

  renderBottles();

  /* ---------- Theme color on load ---------- */
  requestAnimationFrame(updateScrollUI);
})();
