const $ = (selector) => document.querySelector(selector);
const saved = JSON.parse(localStorage.getItem("intoWildReader") || "{}");
let book, index = Number.isInteger(saved.index) ? saved.index : 0;
let lastTerm = "";

const glossary = {
  wilderness: "荒野；人烟稀少的自然地区", hitchhiker: "搭便车旅行者", "well-to-do": "富裕的；家境优渥的",
  affluent: "富裕的；富足的", elite: "精英的；出类拔萃的", transcendent: "超越平常的；卓越的",
  peregrinations: "（长途或漫无目的的）旅行；漫游", obsession: "痴迷；执念", enigma: "谜；难以理解的人或事",
  asceticism: "禁欲主义；苦行", adversity: "逆境；困苦", ordeal: "严峻考验；煎熬",
  pivotal: "关键的；转折性的", bewildered: "困惑不解的；茫然的", fulminated: "强烈谴责；怒斥",
  reckless: "鲁莽的；不顾后果的", narcissist: "自恋者", muskeg: "（北方）泥炭沼泽地",
  congenial: "友善的；令人愉快的", foolhardy: "有勇无谋的；鲁莽的", dissuade: "劝阻；使放弃",
  navigational: "导航的；航行定位的", scrounged: "设法弄到；搜罗到", unmaintained: "未维护的；年久失修的",
  derelict: "废弃的；破旧失修的", incongruously: "不协调地；不合时宜地", obliterated: "完全抹去；毁掉",
  contumacious: "桀骜不驯的；倔强不服从的", itinerant: "流动的；四处奔波的",
  surrogate: "替代的；代理的", estranged: "疏远的；关系破裂的", emancipated: "摆脱束缚的；获得自由的",
  odyssey: "漫长而充满经历的旅程", stifling: "令人窒息的；压抑的", unencumbered: "无牵挂的；没有负担的"
};

function persist() { localStorage.setItem("intoWildReader", JSON.stringify({ index, dark: document.body.classList.contains("dark") })); }
function escapeHtml(text) { const node = document.createElement("div"); node.textContent = text; return node.innerHTML; }
function cleanPageNumber(line) { return /^\d{1,3}$/.test(line.trim()); }
function paragraphs(text) {
  return text.split(/\n\s*\n/).map(block => block.replace(/\n/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter(block => block && !cleanPageNumber(block))
    .map(block => `<p${block.length < 520 && /^[A-Z][A-Z ,.';:—-]+$/.test(block) ? ' class="quote"' : ""}>${escapeHtml(block)}</p>`).join("");
}
function renderToc(filter = "") {
  const query = filter.trim().toLowerCase();
  $("#chapterList").innerHTML = book.sections.map((section, i) => ({section, i}))
    .filter(({section}) => section.title.toLowerCase().includes(query))
    .map(({section, i}) => `<button class="chapter-link ${i === index ? "active" : ""}" data-index="${i}">${escapeHtml(section.title)}</button>`).join("");
  document.querySelectorAll(".chapter-link").forEach(button => button.addEventListener("click", () => showSection(Number(button.dataset.index), true)));
}
function showSection(nextIndex, scroll = false) {
  index = Math.max(0, Math.min(nextIndex, book.sections.length - 1));
  const section = book.sections[index];
  $("#book").innerHTML = `<p class="chapter-kicker">${index ? `Chapter ${index}` : "Preface"} · PDF pages ${section.pages[0]}-${section.pages.at(-1)}</p><h1 class="chapter-title">${escapeHtml(section.title)}</h1><div class="text">${paragraphs(section.text)}</div>`;
  $("#progress").textContent = `${index + 1} / ${book.sections.length}`;
  $("#previous").disabled = index === 0; $("#next").disabled = index === book.sections.length - 1;
  renderToc($("#chapterSearch").value); persist();
  if (scroll) { window.scrollTo({ top: 0, behavior: "smooth" }); $("#toc").classList.remove("open"); }
}
function closePopup() { $("#translationPopup").hidden = true; }
function placePopup(rect) {
  const popup = $("#translationPopup");
  popup.hidden = false;
  const width = popup.offsetWidth, height = popup.offsetHeight, gap = 13;
  const left = Math.max(14, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 14));
  const above = rect.top - height - gap;
  const top = above > 70 ? above : Math.min(rect.bottom + gap, window.innerHeight - height - 14);
  popup.style.left = `${left}px`; popup.style.top = `${top}px`;
  popup.style.setProperty("--arrow-x", `${Math.max(20, Math.min(rect.left + rect.width / 2 - left - 6, width - 28))}px`);
}
function formatTranslation(term, translation, source = "在线翻译") {
  $("#lookupTerm").textContent = term;
  $("#definition").innerHTML = `<p class="label">${source}</p><p class="meaning">${escapeHtml(translation)}</p>`;
  $("#copyTerm").disabled = false;
}
async function lookup(term, rect) {
  term = term.replace(/[“”"'.,;:!?()[\]{}]/g, "").replace(/\s+/g, " ").trim();
  if (!term || term.length > 80) return;
  lastTerm = term; $("#lookupTerm").textContent = term; $("#definition").innerHTML = '<p class="muted">正在查询释义…</p>'; $("#copyTerm").disabled = true; placePopup(rect);
  const known = glossary[term.toLowerCase()];
  if (known) { formatTranslation(term, known, "内置词表"); return; }
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(term)}&langpair=en|zh-CN`;
    const response = await fetch(url);
    const data = await response.json();
    if (!data.responseData?.translatedText) throw new Error("no translation");
    formatTranslation(term, data.responseData.translatedText);
  } catch (_) {
    $("#definition").innerHTML = `<p class="label">离线提示</p><p>暂时无法联网翻译 <strong>${escapeHtml(term)}</strong>。</p><p class="muted">已保留该词语，可点击下方按钮复制后查词；常见荒野主题词仍可使用内置词表。</p>`;
    $("#copyTerm").disabled = false;
  }
}
function selectedText() { return window.getSelection().toString().trim(); }
function handlePointer(event) {
  const selection = selectedText();
  if (selection) { const range = window.getSelection().getRangeAt(0); lookup(selection, range.getBoundingClientRect()); return; }
  const text = event.target.closest("p")?.textContent || "";
  if (!text) return;
  const range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
  if (!range?.startContainer?.textContent) return;
  const value = range.startContainer.textContent;
  const pos = range.startOffset;
  const before = value.slice(0, pos).match(/[A-Za-z][A-Za-z'-]*$/)?.[0] || "";
  const after = value.slice(pos).match(/^[A-Za-z'-]*/)?.[0] || "";
  const word = (before + after).replace(/^[-']+|[-']+$/g, "");
  if (word.length > 1) lookup(word, range.getBoundingClientRect());
}

async function init() {
  if (saved.dark) document.body.classList.add("dark");
  try { book = await fetch("book.json").then(response => { if (!response.ok) throw new Error(); return response.json(); }); }
  catch (_) { $("#book").innerHTML = '<div class="loading">无法读取书籍数据。请通过本地服务器打开本网页，而不要直接双击 HTML 文件。</div>'; return; }
  index = Math.min(index, book.sections.length - 1); renderToc(); showSection(index);
  $("#tocToggle").onclick = () => $("#toc").classList.add("open"); $("#tocClose").onclick = () => $("#toc").classList.remove("open");
  $("#vocabHint").onclick = () => alert("点击一个英文单词，或拖选一个英文短语，即可在原文旁查看中文释义。"); $("#popupClose").onclick = closePopup;
  $("#themeToggle").onclick = () => { document.body.classList.toggle("dark"); persist(); };
  $("#chapterSearch").oninput = e => renderToc(e.target.value); $("#previous").onclick = () => showSection(index - 1, true); $("#next").onclick = () => showSection(index + 1, true);
  $("#book").addEventListener("mouseup", event => setTimeout(() => handlePointer(event), 0));
  document.addEventListener("mousedown", event => { if (!event.target.closest("#translationPopup") && !event.target.closest("#book")) closePopup(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closePopup(); });
  $("#copyTerm").onclick = async () => { await navigator.clipboard.writeText(lastTerm); $("#copyTerm").textContent = "已复制"; setTimeout(() => $("#copyTerm").textContent = "复制词语", 1300); };
}
init();
