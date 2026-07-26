(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var config = {
    frontendUrl: String(script.dataset.frontendUrl || ""),
    assetBase: String(script.dataset.assetBase || ""),
    revision: String(script.dataset.revision || "local"),
    mode: String(script.dataset.mode || "stage"),
    galgameScriptId: String(script.dataset.galgameScriptId || "8f69fa0e-1a51-4f63-9dc0-1129ef0ab4d7"),
    galgameScriptName: String(script.dataset.galgameScriptName || "国王游戏·Galgame输出协议")
  };
  var token = "hypnoos-owner-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);

  function textId(value) {
    if (value === null || value === undefined) return "";
    var text = String(value).trim();
    return text === "undefined" || text === "null" ? "" : text;
  }

  function candidateWindows() {
    var list = [];
    [window, window.parent, window.top].forEach(function (view) {
      try {
        if (view && list.indexOf(view) < 0) list.push(view);
      } catch (_) {}
    });
    return list;
  }

  function messageIdFromWindow() {
    try {
      if (typeof window.getCurrentMessageId === "function") {
        var own = textId(window.getCurrentMessageId());
        if (own) return own;
      }
    } catch (_) {}
    try {
      var frameNode = window.frameElement;
      var messageNode = frameNode && frameNode.closest ? frameNode.closest(".mes[mesid],[mesid],[data-message-id],[data-mes-id]") : null;
      if (messageNode) {
        var frameId = textId(messageNode.getAttribute("mesid") || messageNode.getAttribute("data-message-id") || messageNode.getAttribute("data-mes-id"));
        if (frameId) return frameId;
      }
    } catch (_) {}
    try {
      var node = script;
      while (node && node !== document.documentElement) {
        var attrs = ["mesid", "message_id", "data-message-id", "data-mes-id", "data-messageid", "data-index"];
        for (var j = 0; j < attrs.length; j += 1) {
          var value = textId(node.getAttribute && node.getAttribute(attrs[j]));
          if (value) return value;
        }
        node = node.parentElement;
      }
    } catch (_) {}
    var views = candidateWindows();
    for (var i = 0; i < views.length; i += 1) {
      var view = views[i];
      if (view === window) continue;
      try {
        if (typeof view.getCurrentMessageId === "function") {
          var direct = textId(view.getCurrentMessageId());
          if (direct) return direct;
        }
      } catch (_) {}
    }
    return "";
  }

  function findHostWindow() {
    var candidates = candidateWindows().slice().reverse();
    for (var i = 0; i < candidates.length; i += 1) {
      try {
        var view = candidates[i];
        var doc = view.document;
        if (!doc || !doc.body) continue;
        if (doc.querySelector("#chat,.mes[mesid],#send_textarea") || view.SillyTavern || typeof view.getContext === "function") return view;
      } catch (_) {}
    }
    return window;
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function createRegistry(host) {
    var hostDocument = host.document;
    var owners = new Map();
    var ownerOrder = [];
    var shell = null;
    var shadow = null;
    var frame = null;
    var launcher = null;
    var panel = null;
    var floorSelect = null;
    var modeButton = null;
    var stateBadge = null;
    var titleFloor = null;
    var galgameToggle = null;
    var galgameDialog = null;
    var resourcePanel = null;
    var encounterDetailHost = null;
    var galgameBusy = false;
    var selectedId = "";
    var selectionMode = "follow";
    var loadedForWritableId = "";
    var dragState = null;
    var launcherDragState = null;
    var suppressLauncherClick = false;
    var stageSubscribers = new Set();
    var shellOpen = false;
    var storageKey = "hypnoos.floatingPhone.ui.v1";
    var mountTimer = 0;
    var profileOpenTimer = 0;
    var pendingProfileRole = "";
    var fetchController = null;
    var hostClickHandler = null;
    var hostResizeHandler = null;
    var galgameObserver = null;
    var galgameRenderFrame = 0;
    var galgameHydrator = null;
    var galgameHydratorToken = "";
    var actionFoldObserver = null;
    var actionFoldRenderFrame = 0;
    var actionFoldObservedFrames = new WeakSet();
    var resourceRefreshToken = 0;
    var resourceEventStops = [];
    var resourceEventsSubscribed = false;
    var GALGAME_STYLE_ID = "st-galgame-narrative-bootstrap-style-v1";
    var GALGAME_RUNTIME_KEY = "__ST_HYPNOOS_GALGAME_HOST_RUNTIME__";
    var GALGAME_MARKER_RE = /⟪人物演出总块⟫([\s\S]*?)⟪\/人物演出总块⟫/;
    var GALGAME_SEGMENT_RE = /〔(动作|台词|思考)〕([\s\S]*?)(?=〔(?:动作|台词|思考)〕|$)/g;
    var ACTION_FOLD_OPEN = "⟪HYPNOOS_ACTION_FOLD_V3⟫";
    var ACTION_FOLD_CLOSE = "⟪/HYPNOOS_ACTION_FOLD_V3⟫";
    var ACTION_FOLD_MARKER_RE = /⟪HYPNOOS_ACTION_FOLD_V3⟫([\s\S]*?)⟪\/HYPNOOS_ACTION_FOLD_V3⟫/;

    function ensureGalgameStyle() {
      if (!hostDocument.head || hostDocument.getElementById(GALGAME_STYLE_ID)) return;
      var style = hostDocument.createElement("style");
      style.id = GALGAME_STYLE_ID;
      style.textContent = [
        ".mes_text .st-galgame-card{--gg-hue:206;--gg-accent:hsl(var(--gg-hue) 88% 72%);position:relative;display:block;width:100%;box-sizing:border-box;margin:16px 0 14px;overflow:hidden;border:1px solid hsl(var(--gg-hue) 72% 68%/.34);border-radius:16px;background:linear-gradient(136deg,hsl(var(--gg-hue) 43% 10%/.98),hsl(calc(var(--gg-hue) + 22) 38% 15%/.97) 58%,hsl(var(--gg-hue) 42% 8%/.99));box-shadow:0 15px 34px rgba(0,0,0,.3),inset 0 1px rgba(255,255,255,.07);color:hsl(var(--gg-hue) 70% 94%);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans SC',sans-serif}",
        ".mes_text .st-galgame-card.is-joined-prev{margin-top:-10px;border-top-left-radius:6px;border-top-right-radius:6px}.mes_text .st-galgame-card.is-joined-next{margin-bottom:4px;border-bottom-left-radius:6px;border-bottom-right-radius:6px}",
        ".mes_text .st-galgame-card>summary{position:relative;display:grid;grid-template-columns:66px minmax(0,1fr) auto;align-items:center;gap:12px;min-height:76px;padding:10px 13px;cursor:pointer;list-style:none;background:linear-gradient(90deg,hsl(var(--gg-hue) 75% 54%/.18),transparent);user-select:none}.mes_text .st-galgame-card.is-side-right>summary{grid-template-columns:auto minmax(0,1fr) 66px;background:linear-gradient(270deg,hsl(var(--gg-hue) 75% 54%/.18),transparent)}.mes_text .st-galgame-card>summary::marker{display:none}.mes_text .st-galgame-card>summary::-webkit-details-marker{display:none}",
        ".mes_text .st-galgame-card__portrait{position:relative;width:62px;height:62px;overflow:hidden;border:1px solid hsl(var(--gg-hue) 86% 78%/.52);border-radius:14px;background:linear-gradient(145deg,hsl(var(--gg-hue) 62% 31%/.68),rgba(15,23,42,.92));padding:0;color:inherit;font:inherit}.mes_text button.st-galgame-card__portrait{cursor:pointer}.mes_text .st-galgame-card.is-side-right .st-galgame-card__portrait{grid-column:3}.mes_text .st-galgame-card.is-side-right .st-galgame-card__identity{grid-column:2;grid-row:1;text-align:right}.mes_text .st-galgame-card.is-side-right .st-galgame-card__toggle{grid-column:1;grid-row:1}",
        ".mes_text .st-galgame-card__portrait img{display:block;width:100%;height:100%;object-fit:cover;object-position:center top;opacity:0}.mes_text .st-galgame-card__portrait.is-loaded img{opacity:1}.mes_text .st-galgame-card__portrait-fallback{display:grid;width:100%;height:100%;place-items:center;color:var(--gg-accent);font:900 22px/1 ui-serif,Georgia,'Noto Serif SC',serif}.mes_text .st-galgame-card__portrait.is-loaded .st-galgame-card__portrait-fallback{display:none}",
        ".mes_text .st-galgame-card__identity{display:grid;gap:5px;min-width:0}.mes_text .st-galgame-card__name-row{display:flex;align-items:center;gap:9px;min-width:0}.mes_text .st-galgame-card.is-side-right .st-galgame-card__name-row{justify-content:flex-end}.mes_text .st-galgame-card__name{display:inline-flex;align-items:baseline;gap:8px;min-width:0;overflow:hidden;color:var(--gg-accent);font-size:18px;font-weight:950;letter-spacing:.045em;text-overflow:ellipsis;white-space:nowrap}.mes_text .st-galgame-card__name-original{text-decoration:line-through;opacity:.52;font-size:.76em}.mes_text .st-galgame-card__name-nickname{color:var(--gg-accent);font-family:'HanziPen SC','Kaiti SC','STKaiti',cursive}.mes_text .st-galgame-card__name-nickname.is-private{color:#ffb4a2}.mes_text .st-galgame-card__name-nickname.is-recognized{color:#86efcf}",
        ".mes_text .st-galgame-card__expression{flex:0 0 auto;border:1px solid hsl(var(--gg-hue) 76% 71%/.28);border-radius:999px;background:hsl(var(--gg-hue) 67% 44%/.16);padding:4px 8px;color:hsl(var(--gg-hue) 88% 82%);font:850 12px/1 ui-monospace,monospace}.mes_text .st-galgame-card__toggle{display:grid;place-items:center;width:26px;height:26px;border:1px solid hsl(var(--gg-hue) 80% 76%/.25);border-radius:50%;color:var(--gg-accent)}.mes_text .st-galgame-card[open] .st-galgame-card__toggle{transform:rotate(180deg)}",
        ".mes_text .st-galgame-card__body{position:relative;display:grid;gap:5px;padding:10px 16px 14px 91px;border-top:1px solid hsl(var(--gg-hue) 76% 67%/.17)}.mes_text .st-galgame-card.is-side-right .st-galgame-card__body{padding:10px 91px 14px 16px;text-align:right}.mes_text .st-galgame-card__segment{display:block;min-width:0;white-space:pre-wrap;overflow-wrap:anywhere}.mes_text .st-galgame-card__segment--action{padding:3px 0;color:hsl(var(--gg-hue) 44% 83%/.72);font-family:ui-serif,Georgia,serif;font-size:12px;font-style:italic;line-height:1.58}.mes_text .st-galgame-card__segment--action::before{content:'＊';margin-right:6px;color:var(--gg-accent)}.mes_text .st-galgame-card__segment--speech{padding:5px 0;color:hsl(var(--gg-hue) 82% 92%);font-size:14px;font-weight:740;line-height:1.72}.mes_text .st-galgame-card__segment--speech::before{content:'“';color:var(--gg-accent)}.mes_text .st-galgame-card__segment--speech::after{content:'”';color:var(--gg-accent)}.mes_text .st-galgame-card__segment--thought{padding:5px 0;color:hsl(var(--gg-hue) 46% 88%/.76);font-family:ui-serif,Georgia,serif;font-size:13px;font-style:italic;line-height:1.72}",
        ".mes_text .st-galgame-card.is-user{--gg-hue:42!important;width:92%;border-color:rgba(253,230,138,.48)}.mes_text .st-galgame-card.is-user .st-galgame-card__portrait{border-radius:50%}.mes_text .st-galgame-card.is-user .st-galgame-card__portrait img{display:none}.mes_text .st-galgame-card.is-user .st-galgame-card__name{color:#fde68a}",
        "@media(max-width:520px){.mes_text .st-galgame-card>summary{grid-template-columns:54px minmax(0,1fr) auto;gap:9px;min-height:66px;padding:8px 9px}.mes_text .st-galgame-card.is-side-right>summary{grid-template-columns:auto minmax(0,1fr) 54px}.mes_text .st-galgame-card__portrait{width:50px;height:50px}.mes_text .st-galgame-card__name{font-size:15px}.mes_text .st-galgame-card__body{padding:9px 10px 11px 72px}.mes_text .st-galgame-card.is-side-right .st-galgame-card__body{padding:9px 72px 11px 10px}}"
      ].join("");
      hostDocument.head.appendChild(style);
    }

    function galgameUserName() {
      try {
        var data = context();
        return textId(data && (data.name1 || data.userName)) || "user";
      } catch (_) { return "user"; }
    }

    function isGalgameUserRole(roleName) {
      var role = textId(roleName);
      if (role.toLowerCase() === "user" || role.toLowerCase() === "{{user}}") return true;
      var current = galgameUserName();
      return current !== "user" && role === current;
    }

    function parseGalgameSegments(content) {
      var source = String(content || "").trim();
      var segments = [];
      GALGAME_SEGMENT_RE.lastIndex = 0;
      var match;
      while ((match = GALGAME_SEGMENT_RE.exec(source))) {
        var value = String(match[2] || "").trim();
        if (value) segments.push({ kind: String(match[1] || "台词"), text: value });
      }
      if (!segments.length && source) segments.push({ kind: "动作", text: source });
      return segments;
    }

    function parseGalgameEntries(content) {
      var source = String(content || "").replace(/\r\n?/g, "\n").trim();
      if (!source) return [];
      var entries = [];
      var roles = new Set();
      var cursor = 0;
      var entryPattern = /^\s*【([^<>\n【】]+?)】\s*([^<>\n【】\s][^<>\n【】]*?)\s*【交互】([^<>]+?)(?=\s*【[^<>\n【】]+?】\s*[^<>\n【】\s][^<>\n【】]*?\s*【交互】|\s*$)/;
      while (cursor < source.length) {
        var match = source.slice(cursor).match(entryPattern);
        if (!match) return null;
        var role = textId(match[1]);
        var expression = textId(match[2]);
        var interaction = textId(match[3]);
        if (!role || !interaction || roles.has(role)) return null;
        roles.add(role);
        entries.push([role, expression, interaction]);
        cursor += match[0].length;
      }
      return cursor === source.length ? entries : null;
    }

    function hydrateGalgameCard(card) {
      if (!card || card.dataset.galgameUser === "true" || !galgameHydrator) return;
      try {
        galgameHydrator.hydrateCard(card, textId(card.dataset.galgameRole));
      } catch (_) {}
    }

    function createGalgameCard(fields) {
      var protocolRole = textId(fields && fields[0]);
      var isUser = isGalgameUserRole(protocolRole);
      var roleName = isUser ? galgameUserName() : protocolRole;
      var expression = textId(fields && fields[1]);
      var card = hostDocument.createElement("details");
      card.className = "st-galgame-card";
      if (isUser) card.classList.add("is-user");
      card.open = true;
      card.dataset.galgameRole = isUser ? "user" : roleName;
      card.dataset.galgameUser = isUser ? "true" : "false";
      var summary = hostDocument.createElement("summary");
      var portrait = hostDocument.createElement(isUser ? "span" : "button");
      portrait.className = "st-galgame-card__portrait";
      if (!isUser) {
        portrait.type = "button";
        portrait.title = "打开" + roleName + "的人物档案";
        portrait.setAttribute("aria-label", portrait.title);
      }
      var image = hostDocument.createElement("img");
      image.alt = roleName;
      image.loading = "eager";
      image.decoding = "async";
      var fallback = hostDocument.createElement("span");
      fallback.className = "st-galgame-card__portrait-fallback";
      fallback.textContent = isUser ? "YOU" : roleName.slice(0, 1) || "人";
      portrait.append(image, fallback);
      var identity = hostDocument.createElement("span");
      identity.className = "st-galgame-card__identity";
      var nameRow = hostDocument.createElement("span");
      nameRow.className = "st-galgame-card__name-row";
      var name = hostDocument.createElement("strong");
      name.className = "st-galgame-card__name";
      name.textContent = roleName;
      nameRow.appendChild(name);
      if (expression) {
        var badge = hostDocument.createElement("span");
        badge.className = "st-galgame-card__expression";
        badge.textContent = expression;
        nameRow.appendChild(badge);
      }
      identity.appendChild(nameRow);
      var toggle = hostDocument.createElement("span");
      toggle.className = "st-galgame-card__toggle";
      toggle.textContent = "⌃";
      summary.append(portrait, identity, toggle);
      var body = hostDocument.createElement("span");
      body.className = "st-galgame-card__body";
      parseGalgameSegments(fields && fields[2]).forEach(function (segment) {
        var line = hostDocument.createElement("span");
        var type = segment.kind === "动作" ? "action" : segment.kind === "思考" ? "thought" : "speech";
        line.className = "st-galgame-card__segment st-galgame-card__segment--" + type;
        line.textContent = segment.text;
        body.appendChild(line);
      });
      card.append(summary, body);
      hydrateGalgameCard(card);
      return card;
    }

    function decorateGalgameCards(container) {
      var cards = Array.prototype.slice.call(container.querySelectorAll(".st-galgame-card"));
      cards.forEach(function (card, index) {
        card.classList.remove("is-side-left", "is-side-right", "is-joined-prev", "is-joined-next");
        card.classList.add(index % 2 === 0 ? "is-side-left" : "is-side-right");
        card.dataset.galgameSequence = String(index + 1);
        card.style.setProperty("--gg-hue", String((206 + index * 137.508) % 360));
      });
      for (var index = 1; index < cards.length; index += 1) {
        if (cards[index].dataset.galgameJoinPrev !== "true") continue;
        cards[index - 1].classList.add("is-joined-next");
        cards[index].classList.add("is-joined-prev");
      }
    }

    function renderGalgameMarkers() {
      if (!hostDocument.body) return;
      Array.prototype.forEach.call(hostDocument.querySelectorAll(".mes_text"), function (container) {
        var rendered = false;
        for (var pass = 0; pass < 8 && String(container.textContent || "").includes("⟪人物演出总块⟫"); pass += 1) {
          var walker = hostDocument.createTreeWalker(container, host.NodeFilter ? host.NodeFilter.SHOW_TEXT : 4);
          var textNodes = [];
          var source = "";
          while (walker.nextNode()) {
            var node = walker.currentNode;
            if (node.parentElement && node.parentElement.closest(".st-galgame-card,script,style")) continue;
            var value = String(node.nodeValue || "");
            if (!value) continue;
            textNodes.push({ node: node, start: source.length, end: source.length + value.length });
            source += value;
          }
          var match = source.match(GALGAME_MARKER_RE);
          if (!match || match.index == null) break;
          var entries = parseGalgameEntries(match[1]);
          if (!entries || !entries.length) break;
          var startIndex = match.index;
          var endIndex = startIndex + match[0].length;
          var start = textNodes.find(function (item) { return startIndex >= item.start && startIndex <= item.end; });
          var end = textNodes.slice().reverse().find(function (item) { return endIndex >= item.start && endIndex <= item.end; });
          if (!start || !end) break;
          var range = hostDocument.createRange();
          range.setStart(start.node, Math.max(0, startIndex - start.start));
          range.setEnd(end.node, Math.max(0, endIndex - end.start));
          var fragment = hostDocument.createDocumentFragment();
          entries.forEach(function (entry, index) {
            var card = createGalgameCard(entry);
            if (index > 0) card.dataset.galgameJoinPrev = "true";
            fragment.appendChild(card);
          });
          range.deleteContents();
          range.insertNode(fragment);
          rendered = true;
        }
        if (rendered || container.querySelector(".st-galgame-card")) decorateGalgameCards(container);
      });
    }

    function scheduleGalgameRender() {
      if (galgameRenderFrame || !hostDocument.body) return;
      var requestFrame = host.requestAnimationFrame || function (callback) { return host.setTimeout(callback, 0); };
      galgameRenderFrame = requestFrame.call(host, function () {
        galgameRenderFrame = 0;
        renderGalgameMarkers();
      });
    }

    function ensureGalgameRenderer() {
      ensureGalgameStyle();
      var previous = hostDocument[GALGAME_RUNTIME_KEY];
      if (previous && previous.registry !== null && previous.registry !== undefined && previous.registry !== registryApi) {
        try { previous.observer && previous.observer.disconnect(); } catch (_) {}
      }
      if (!galgameObserver) {
        var MutationObserverCtor = host.MutationObserver;
        if (MutationObserverCtor) {
          galgameObserver = new MutationObserverCtor(function (records) {
            for (var index = 0; index < records.length; index += 1) {
              var record = records[index];
              var target = record.type === "characterData" ? record.target.parentElement : record.target;
              var message = target && target.closest ? target.closest(".mes_text") : null;
              if (message && String(message.textContent || "").includes("⟪人物演出总块⟫")) {
                scheduleGalgameRender();
                return;
              }
              var added = Array.prototype.slice.call(record.addedNodes || []);
              if (added.some(function (node) {
                return String(node && node.textContent || "").includes("⟪人物演出总块⟫");
              })) {
                scheduleGalgameRender();
                return;
              }
            }
          });
          galgameObserver.observe(hostDocument.body, { childList: true, characterData: true, subtree: true });
        }
      }
      hostDocument[GALGAME_RUNTIME_KEY] = { version: 1, observer: galgameObserver, registry: registryApi };
      scheduleGalgameRender();
    }

    function actionFoldText(value) {
      return String(value || "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<[^>]*>/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n[ \t]*\n[ \t]*\n+/g, "\n\n")
        .trim();
    }

    function actionFoldPlain(targetDocument, value) {
      var block = targetDocument.createElement("div");
      block.style.cssText = "margin:7px 0;color:#dbeafe;white-space:pre-wrap;line-height:1.65;overflow-wrap:anywhere";
      block.textContent = actionFoldText(value);
      return block;
    }

    function actionFoldNotice(targetDocument, value) {
      var notice = targetDocument.createElement("aside");
      notice.setAttribute("data-hypnoos-action-notice", "v3");
      notice.style.cssText = "display:flex;align-items:flex-start;gap:9px;margin:10px 0;padding:9px 11px;border:1px solid rgba(250,204,21,.42);border-left:4px solid #fbbf24;border-radius:10px;background:linear-gradient(100deg,rgba(120,53,15,.38),rgba(67,20,7,.22));color:#fef3c7";
      var label = targetDocument.createElement("strong");
      label.style.cssText = "flex:0 0 auto;color:#fde68a;font:800 11px/1.4 ui-monospace,monospace";
      label.textContent = "✦ AI 提醒";
      var body = targetDocument.createElement("span");
      body.style.cssText = "min-width:0;white-space:pre-wrap;line-height:1.55";
      body.textContent = actionFoldText(value);
      notice.append(label, body);
      return notice;
    }

    function actionFoldPermission(targetDocument, value) {
      var card = targetDocument.createElement("aside");
      card.setAttribute("data-hypnoos-action-permission", "v3");
      card.style.cssText = "margin:9px 0;padding:9px 11px;border:1px solid rgba(96,165,250,.32);border-left:4px solid #60a5fa;border-radius:10px;background:rgba(30,64,175,.14);color:#dbeafe;white-space:pre-wrap;line-height:1.62";
      card.textContent = "变量权限\n" + actionFoldText(value);
      return card;
    }

    function actionFoldNested(targetDocument, kind, titleText, bodyText) {
      var details = targetDocument.createElement("details");
      details.setAttribute(kind === "item" ? "data-hypnoos-action-item" : "data-hypnoos-action-section", "v3");
      details.style.cssText = kind === "item"
        ? "display:block;margin:7px 0;border:1px solid rgba(165,180,252,.28);border-radius:9px;overflow:hidden;background:rgba(15,23,42,.32);color:#e2e8f0"
        : "display:block;margin:9px 0;border:1px solid rgba(129,140,248,.34);border-radius:12px;overflow:hidden;background:linear-gradient(120deg,rgba(49,46,129,.30),rgba(15,23,42,.28));color:#e2e8f0";
      var summary = targetDocument.createElement("summary");
      summary.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;list-style:none;font-weight:800;line-height:1.4";
      summary.textContent = (kind === "item" ? "◆ " : "◈ ") + (actionFoldText(titleText) || (kind === "item" ? "操作项" : "来源"));
      var body = targetDocument.createElement("div");
      body.style.cssText = "padding:9px 11px 11px;border-top:1px solid rgba(165,180,252,.22);color:#dbeafe;white-space:pre-wrap;line-height:1.62";
      if (kind === "section") appendActionFoldContent(targetDocument, body, bodyText);
      else body.textContent = actionFoldText(bodyText);
      details.append(summary, body);
      return details;
    }

    function nextActionFoldUnit(source, fromIndex) {
      var definitions = [
        { kind: "permission", regex: /<\s*变量权限\s*>\s*([\s\S]*?)\s*<\s*\/\s*变量权限\s*>/gi },
        { kind: "notice", regex: /<\s*AI提醒\s*>\s*([\s\S]*?)\s*<\s*\/\s*AI提醒\s*>/gi },
        { kind: "item", regex: /<\s*操作项\s*>\s*<\s*操作名\s*>\s*([\s\S]*?)\s*<\s*\/\s*操作名\s*>\s*<\s*操作内容\s*>\s*([\s\S]*?)\s*<\s*\/\s*操作内容\s*>\s*<\s*\/\s*操作项\s*>/gi },
        { kind: "section", regex: /<\s*(相关变量|时钟|地图|学校|学校地图|催眠APP|催眠命令|催眠资源|催眠道具|成就和任务|成就|任务|校规|初始校规|打工|监控|邂逅|人物档案|库存|物品|子嗣|派遣|警视厅|综合医院|医院|旧校舍|灵异|性格特调|改造|附身|课程表|日历|系统|设置|场景|事件|地点|APP)\s*>\s*([\s\S]*?)\s*<\s*\/\s*\1\s*>/gi }
      ];
      var selected = null;
      definitions.forEach(function (definition) {
        definition.regex.lastIndex = fromIndex;
        var match = definition.regex.exec(source);
        if (!match || (selected && match.index >= selected.start)) return;
        selected = {
          kind: definition.kind,
          start: match.index,
          end: match.index + match[0].length,
          title: definition.kind === "section" || definition.kind === "item" ? match[1] : "",
          body: definition.kind === "section" || definition.kind === "item" ? match[2] : match[1]
        };
      });
      return selected;
    }

    function appendActionFoldContent(targetDocument, parent, value) {
      var source = String(value || "");
      var cursor = 0;
      var unit;
      while ((unit = nextActionFoldUnit(source, cursor))) {
        if (unit.start > cursor) {
          var plain = actionFoldPlain(targetDocument, source.slice(cursor, unit.start));
          if (plain.textContent) parent.appendChild(plain);
        }
        if (unit.kind === "notice") parent.appendChild(actionFoldNotice(targetDocument, unit.body));
        else if (unit.kind === "permission") parent.appendChild(actionFoldPermission(targetDocument, unit.body));
        else parent.appendChild(actionFoldNested(targetDocument, unit.kind, unit.title, unit.body));
        cursor = unit.end;
      }
      if (cursor < source.length) {
        var tail = actionFoldPlain(targetDocument, source.slice(cursor));
        if (tail.textContent) parent.appendChild(tail);
      }
    }

    function createActionFoldCard(targetDocument, value) {
      var details = targetDocument.createElement("details");
      details.setAttribute("data-hypnoos-action-fold", "v3");
      details.style.cssText = "display:block;margin:12px 0;border:1px solid rgba(129,140,248,.48);border-left:3px solid #818cf8;border-radius:14px;overflow:hidden;background:linear-gradient(135deg,rgba(30,27,75,.88),rgba(15,23,42,.92));box-shadow:0 9px 22px rgba(0,0,0,.2);color:#e2e8f0;font-family:ui-sans-serif,system-ui,sans-serif";
      var summary = targetDocument.createElement("summary");
      summary.style.cssText = "cursor:pointer;display:flex;align-items:center;gap:10px;padding:11px 14px;color:#eef2ff;letter-spacing:.04em;list-style:none";
      var label = targetDocument.createElement("span");
      label.style.cssText = "font-size:11px;font-weight:800;color:#a5b4fc;letter-spacing:.16em";
      label.textContent = "前端操作";
      var title = targetDocument.createElement("strong");
      title.style.cssText = "font-size:14px;font-weight:650";
      title.textContent = "本轮操作";
      var hint = targetDocument.createElement("span");
      hint.style.cssText = "margin-left:auto;color:rgba(199,210,254,.78);font-size:12px";
      hint.textContent = "点击展开";
      summary.append(label, title, hint);
      var body = targetDocument.createElement("div");
      body.setAttribute("data-hypnoos-action-body", "v3");
      body.style.cssText = "padding:13px 17px 15px;border-top:1px solid rgba(129,140,248,.28);line-height:1.82;color:#dbeafe;overflow-wrap:anywhere";
      appendActionFoldContent(targetDocument, body, value);
      if (!body.childNodes.length) body.textContent = "本轮没有可展开的前端操作。";
      details.append(summary, body);
      return details;
    }

    function renderActionFoldRoot(targetDocument, root) {
      if (!root || !String(root.textContent || "").includes(ACTION_FOLD_OPEN)) return false;
      var walker = targetDocument.createTreeWalker(root, targetDocument.defaultView && targetDocument.defaultView.NodeFilter ? targetDocument.defaultView.NodeFilter.SHOW_TEXT : 4);
      var nodes = [];
      var source = "";
      while (walker.nextNode()) {
        var node = walker.currentNode;
        if (node.parentElement && node.parentElement.closest("[data-hypnoos-action-fold],script,style,textarea,template")) continue;
        var text = String(node.nodeValue || "");
        if (!text) continue;
        nodes.push({ node: node, start: source.length, end: source.length + text.length });
        source += text;
      }
      var rendered = false;
      for (var pass = 0; pass < 8; pass += 1) {
        var match = source.match(ACTION_FOLD_MARKER_RE);
        if (!match || match.index == null) break;
        var startIndex = match.index;
        var endIndex = startIndex + match[0].length;
        var start = nodes.find(function (item) { return startIndex >= item.start && startIndex <= item.end; });
        var end = nodes.slice().reverse().find(function (item) { return endIndex >= item.start && endIndex <= item.end; });
        if (!start || !end) break;
        var range = targetDocument.createRange();
        range.setStart(start.node, Math.max(0, startIndex - start.start));
        range.setEnd(end.node, Math.max(0, endIndex - end.start));
        range.deleteContents();
        range.insertNode(createActionFoldCard(targetDocument, match[1]));
        rendered = true;
        return renderActionFoldRoot(targetDocument, root) || rendered;
      }
      return rendered;
    }

    function actionFoldDocuments() {
      var documents = [hostDocument];
      Array.prototype.forEach.call(hostDocument.querySelectorAll("iframe"), function (iframe) {
        if (!actionFoldObservedFrames.has(iframe)) {
          actionFoldObservedFrames.add(iframe);
          try { iframe.addEventListener("load", scheduleActionFoldRender); } catch (_) {}
        }
        try {
          if (iframe.contentDocument && iframe.contentDocument.body && documents.indexOf(iframe.contentDocument) < 0) {
            documents.push(iframe.contentDocument);
          }
        } catch (_) {}
      });
      return documents;
    }

    function renderActionFoldMarkers() {
      actionFoldDocuments().forEach(function (targetDocument) {
        var roots = Array.prototype.slice.call(targetDocument.querySelectorAll(".mes_text,#userInputContent"));
        if (!roots.length && targetDocument.body) roots.push(targetDocument.body);
        roots.forEach(function (root) { renderActionFoldRoot(targetDocument, root); });
      });
    }

    function scheduleActionFoldRender() {
      if (actionFoldRenderFrame || !hostDocument.body) return;
      var requestFrame = host.requestAnimationFrame || function (callback) { return host.setTimeout(callback, 0); };
      actionFoldRenderFrame = requestFrame.call(host, function () {
        actionFoldRenderFrame = 0;
        renderActionFoldMarkers();
      });
    }

    function ensureActionFoldRenderer() {
      if (!actionFoldObserver && host.MutationObserver) {
        actionFoldObserver = new host.MutationObserver(function (records) {
          var shouldRender = records.some(function (record) {
            var targetText = record.type === "characterData" ? record.target.nodeValue : record.target && record.target.textContent;
            if (String(targetText || "").includes(ACTION_FOLD_OPEN)) return true;
            return Array.prototype.some.call(record.addedNodes || [], function (node) {
              if (String(node && node.tagName || "").toLowerCase() === "iframe" && !actionFoldObservedFrames.has(node)) {
                actionFoldObservedFrames.add(node);
                try { node.addEventListener("load", scheduleActionFoldRender); } catch (_) {}
              }
              try {
                Array.prototype.forEach.call(node && node.querySelectorAll ? node.querySelectorAll("iframe") : [], function (iframe) {
                  if (actionFoldObservedFrames.has(iframe)) return;
                  actionFoldObservedFrames.add(iframe);
                  try { iframe.addEventListener("load", scheduleActionFoldRender); } catch (_) {}
                });
              } catch (_) {}
              return String(node && node.textContent || "").includes(ACTION_FOLD_OPEN);
            });
          });
          if (shouldRender) scheduleActionFoldRender();
        });
        actionFoldObserver.observe(hostDocument.body, { childList: true, characterData: true, subtree: true });
      }
      scheduleActionFoldRender();
    }

    function registerGalgameHydrator(provider, providerToken) {
      if (!provider || typeof provider.hydrateCard !== "function") return false;
      galgameHydrator = provider;
      galgameHydratorToken = textId(providerToken) || String(Date.now());
      Array.prototype.forEach.call(hostDocument.querySelectorAll(".st-galgame-card[data-galgame-role]"), hydrateGalgameCard);
      return true;
    }

    function refreshGalgameRole(roleName) {
      var name = textId(roleName);
      Array.prototype.forEach.call(hostDocument.querySelectorAll(".st-galgame-card[data-galgame-role]"), function (card) {
        if (!name || textId(card.dataset.galgameRole) === name) hydrateGalgameCard(card);
      });
    }

    var registryApi = null;

    function ownerAlive(owner) {
      try {
        if (!owner || !owner.view || !owner.view.document || owner.view.closed) return false;
        var frameElement = owner.view.frameElement;
        return !frameElement || frameElement.isConnected;
      } catch (_) { return false; }
    }

    function pruneOwners() {
      ownerOrder = ownerOrder.filter(function (id) {
        var owner = owners.get(id);
        if (ownerAlive(owner)) return true;
        owners.delete(id);
        return false;
      });
    }

    function latestOwner() {
      pruneOwners();
	  var alive = ownerOrder.map(function (id) { return owners.get(id); }).filter(ownerAlive);
	  var numeric = alive.filter(function (owner) { return Number.isFinite(Number(owner.messageId)); });
	  if (numeric.length === alive.length && numeric.length) {
	    numeric.sort(function (a, b) { return Number(a.messageId) - Number(b.messageId); });
	    return numeric[numeric.length - 1];
	  }
      for (var i = ownerOrder.length - 1; i >= 0; i -= 1) {
        var owner = owners.get(ownerOrder[i]);
        if (ownerAlive(owner)) return owner;
      }
      return null;
    }

    function writableId() {
      var messages = chatMessages();
      for (var index = messages.length - 1; index >= 0; index -= 1) {
        if (isUserMessage(messages[index], index)) continue;
        var authoritative = messageId(messages[index], index);
        if (authoritative) return authoritative;
      }
      return textId(latestOwner() && latestOwner().messageId);
    }

    function sourceWindows() {
      var list = [];
      var owner = latestOwner();
      [owner && owner.view, host, host.parent, host.top].forEach(function (view) {
        try { if (view && list.indexOf(view) < 0) list.push(view); } catch (_) {}
      });
      return list;
    }

    function findFunction(name) {
      var views = sourceWindows();
      for (var i = 0; i < views.length; i += 1) {
        try {
          if (typeof views[i][name] === "function") return { view: views[i], fn: views[i][name] };
          if (views[i].TavernHelper && typeof views[i].TavernHelper[name] === "function") {
            return { view: views[i].TavernHelper, fn: views[i].TavernHelper[name] };
          }
        } catch (_) {}
      }
      return null;
    }

    function findMvu() {
      var views = sourceWindows();
      for (var i = 0; i < views.length; i += 1) {
        try { if (views[i].Mvu) return views[i].Mvu; } catch (_) {}
      }
      return null;
    }

    function normalizeMessageOption(option) {
      if (option && typeof option === "object" && option.type && option.type !== "message") return option;
      var id = selectedId || writableId();
      return id ? { type: "message", message_id: id } : option;
    }

    function normalizeWriteMessageOption(option) {
      if (option && typeof option === "object") {
        if (option.type && option.type !== "message") return option;
        var explicit = textId(option.message_id !== undefined ? option.message_id : option.mesid);
        if (explicit) return { type: "message", message_id: explicit };
      }
      var id = selectedId || writableId();
      return id ? { type: "message", message_id: id } : option;
    }

    function callApi(name, args) {
      var found = findFunction(name);
      if (!found) return undefined;
      return found.fn.apply(found.view, Array.isArray(args) ? args : []);
    }

    function callMvu(name, args) {
      var mvu = findMvu();
      if (!mvu || typeof mvu[name] !== "function") return undefined;
      return mvu[name].apply(mvu, Array.isArray(args) ? args : []);
    }

    function cloneSnapshot(value) {
      if (!value || typeof value !== "object") return value;
      try {
        if (typeof host.structuredClone === "function") return host.structuredClone(value);
      } catch (_) {}
      try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
    }

    function cloneReadResult(value) {
      if (value && typeof value.then === "function") return value.then(cloneSnapshot);
      return cloneSnapshot(value);
    }

    function findGalgameScript(items) {
      if (!Array.isArray(items)) return null;
      for (var i = 0; i < items.length; i += 1) {
        var item = items[i];
        if (!item || typeof item !== "object") continue;
        if (String(item.id || "") === config.galgameScriptId) return item;
        var nested = findGalgameScript(item.scripts);
        if (nested) return nested;
      }
      return null;
    }

    function updateGalgameToggle(enabled, status) {
      if (!galgameToggle) return;
      var known = typeof enabled === "boolean";
      galgameToggle.disabled = galgameBusy || !known;
      galgameToggle.classList.toggle("enabled", enabled === true);
      galgameToggle.classList.toggle("disabled", enabled === false);
      galgameToggle.classList.toggle("busy", galgameBusy);
      galgameToggle.setAttribute("aria-pressed", enabled === true ? "true" : "false");
      galgameToggle.textContent = galgameBusy ? "Galgame …" : known ? "Galgame " + (enabled ? "开" : "关") : "Galgame --";
      galgameToggle.title = status || (known
        ? "只切换“" + config.galgameScriptName + "”酒馆助手脚本；不修改显示正则"
        : "未找到酒馆助手脚本管理 API 或目标脚本");
    }

    function showGalgameDialog(options) {
      if (!galgameDialog) return;
      var source = options && typeof options === "object" ? options : {};
      var title = galgameDialog.querySelector("[data-galgame-dialog-title]");
      var body = galgameDialog.querySelector("[data-galgame-dialog-body]");
      if (title) title.textContent = String(source.title || "Galgame人物演出");
      if (body) body.textContent = String(source.message || "");
      galgameDialog.classList.toggle("is-error", source.error === true);
      galgameDialog.classList.add("open");
      galgameDialog.setAttribute("aria-hidden", "false");
    }

    function closeGalgameDialog() {
      if (!galgameDialog) return;
      galgameDialog.classList.remove("open", "is-error");
      galgameDialog.setAttribute("aria-hidden", "true");
    }

    async function readGalgameState() {
      var trees = await Promise.resolve(callApi("getScriptTrees", [{ type: "character" }]));
      if (!Array.isArray(trees)) return { enabled: null, trees: null };
      var target = findGalgameScript(trees);
      return { enabled: target ? target.enabled !== false : null, trees: trees };
    }

    async function syncGalgameState() {
      try {
        var state = await readGalgameState();
        updateGalgameToggle(state.enabled);
        return state.enabled;
      } catch (error) {
        updateGalgameToggle(null, "读取 Galgame 脚本状态失败：" + String(error && error.message || error));
        return null;
      }
    }

    async function syncGalgameRuntimeEnabled(enabled) {
      var views = candidateWindows();
      for (var i = 0; i < views.length; i += 1) {
        try {
          var runtime = views[i].__ST_HYPNOOS_GALGAME_INJECTION_RUNTIME__;
          if (runtime && typeof runtime.setEnabled === "function") {
            await Promise.resolve(runtime.setEnabled(Boolean(enabled)));
            return true;
          }
        } catch (_) {}
      }
      return false;
    }

    async function setGalgameEnabled(nextEnabled) {
      if (galgameBusy) return;
      galgameBusy = true;
      updateGalgameToggle(Boolean(nextEnabled));
      try {
        var state = await readGalgameState();
        if (!state.trees) throw new Error("酒馆助手脚本管理 API 不可用");
        var trees = cloneSnapshot(state.trees);
        var target = findGalgameScript(trees);
        if (!target) throw new Error("没有找到目标 Galgame 脚本");
        if (String(target.id || "") === "4ebce7e7-3a35-4fa1-9130-bf397905f236") {
          throw new Error("拒绝切换悬浮手机宿主脚本");
        }
        target.enabled = Boolean(nextEnabled);
        if (!findFunction("replaceScriptTrees")) throw new Error("酒馆助手脚本写入 API 不可用");
        var replaced = callApi("replaceScriptTrees", [trees, { type: "character" }]);
        await Promise.resolve(replaced);
        var runtimeSynced = await syncGalgameRuntimeEnabled(Boolean(nextEnabled));
        galgameBusy = false;
        var actual = await syncGalgameState();
        if (actual !== Boolean(nextEnabled)) throw new Error("脚本状态没有成功更新");
        showGalgameDialog({
          title: nextEnabled ? "Galgame人物演出已开启" : "Galgame人物演出已关闭",
          message: (nextEnabled
            ? "后续回复将要求输出人物演出。若在回复生成途中切换，当前轮可能因上下文已经组装而无法立即生效；从下一轮开始更可靠。"
            : "后续回复不再要求输出人物演出。若当前回复已经开始生成，本轮仍可能保留人物演出；从下一轮开始更可靠。")
            + (runtimeSynced ? "" : " 当前运行时未确认即时切换，但脚本开关已经保存。")
        });
      } catch (error) {
        galgameBusy = false;
        await syncGalgameState();
        if (galgameToggle) galgameToggle.title = "切换失败：" + String(error && error.message || error);
        showGalgameDialog({
          title: "Galgame切换失败",
          message: String(error && error.message || error || "没有成功更新脚本状态。"),
          error: true
        });
        console.warn("[HypnoOS] Galgame 脚本切换失败", error);
      }
    }

    function readApi(name, args) {
      return cloneReadResult(callApi(name, args));
    }

    function readMvu(name, args) {
      return cloneReadResult(callMvu(name, args));
    }

    function isWritable() {
      var selected = textId(selectedId || writableId());
      return Boolean(selected && selected === writableId());
    }

    function explicitMessageIds(value, depth) {
      if (!value || typeof value !== "object" || depth > 3) return [];
      if (Array.isArray(value)) {
        return value.reduce(function (ids, item) { return ids.concat(explicitMessageIds(item, depth + 1)); }, []);
      }
      var ids = [];
      if (value.message_id !== undefined || value.mesid !== undefined) {
        var direct = textId(value.message_id !== undefined ? value.message_id : value.mesid);
        if (direct) ids.push(direct);
      }
      if (String(value.type || "").toLowerCase() === "message") {
        var optionId = textId(value.message_id !== undefined ? value.message_id : value.mesid);
        if (optionId) ids.push(optionId);
      }
      return ids;
    }

    function writeTargetsWritable(name, args) {
      var target = writableId();
      if (!target) return false;
      var ids = [];
      (Array.isArray(args) ? args : []).forEach(function (arg) {
        ids = ids.concat(explicitMessageIds(arg, 0));
      });
      if (name === "setChatMessages" && !ids.length) return false;
      return ids.every(function (id) { return id === target; });
    }

    function guardedApi(name, args) {
      if (!isWritable() || !writeTargetsWritable(name, args)) {
        notifyReadOnly();
        return false;
      }
      return callApi(name, args);
    }

    function guardedMvu(name, args) {
      if (!isWritable() || !writeTargetsWritable(name, args)) {
        notifyReadOnly();
        return false;
      }
      return callMvu(name, args);
    }

    function context() {
      for (var i = 0; i < sourceWindows().length; i += 1) {
        var view = sourceWindows()[i];
        try {
          var result = view.SillyTavern && view.SillyTavern.getContext ? view.SillyTavern.getContext() : null;
          if (!result && typeof view.getContext === "function") result = view.getContext();
          if (result) return result;
        } catch (_) {}
      }
      return null;
    }

    function chatMessages() {
      var ctx = context();
      if (Array.isArray(ctx && ctx.chat)) return ctx.chat;
      for (var i = 0; i < sourceWindows().length; i += 1) {
        try { if (Array.isArray(sourceWindows()[i].chat)) return sourceWindows()[i].chat; } catch (_) {}
      }
      return [];
    }

    function messageId(message, index) {
      if (message && typeof message === "object") {
        var values = [message.message_id, message.mesid, message.id];
        for (var i = 0; i < values.length; i += 1) {
          var value = textId(values[i]);
          if (value) return value;
        }
      }
      return String(index);
    }

    function isUserMessage(message, index) {
      if (!message || typeof message !== "object") return false;
      if (message.is_user === true || message.isUser === true || message.from_user === true) return true;
      if (message.is_user === false || message.isUser === false || message.from_user === false) return false;
      var role = String(message.role || message.type || message.sender || "").toLowerCase();
      if (role === "user" || role === "human") return true;
      if (["assistant", "character", "bot", "model", "system"].indexOf(role) >= 0) return false;
      return Number.isInteger(Number(index)) ? Number(index) % 2 === 1 : false;
    }

    function unwrapStat(value) {
      return value && typeof value === "object" && value.stat_data && typeof value.stat_data === "object" ? value.stat_data : value;
    }

    function usableSnapshot(value) {
      var root = unwrapStat(value);
      return Boolean(root && typeof root === "object" && !Array.isArray(root) &&
        ((root["系统"] && typeof root["系统"] === "object") || (root["角色"] && typeof root["角色"] === "object")));
    }

    function formatResourceValue(value) {
      if (value === undefined || value === null || value === "") return "--";
      var number = Number(value);
      if (Number.isFinite(number)) return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(number);
      return String(value);
    }

    function paintSidecarResources(system, loading) {
      if (!resourcePanel) return;
      resourcePanel.classList.toggle("loading", Boolean(loading));
      var values = {
        money: system && system["持有零花钱"],
        starlight: system && system["星光点"],
        energy: system && system["MC能量"]
      };
      Object.keys(values).forEach(function (key) {
        var target = resourcePanel.querySelector("[data-resource-" + key + "]");
        if (target) target.textContent = formatResourceValue(values[key]);
      });
    }

    async function refreshSidecarResources() {
      if (!resourcePanel) return;
      var token = ++resourceRefreshToken;
      var id = textId(selectedId || writableId());
      if (!id) {
        paintSidecarResources(null, false);
        return;
      }
      paintSidecarResources(null, true);
      var option = { type: "message", message_id: id };
      var snapshot = null;
      try { snapshot = await Promise.resolve(callMvu("getMvuData", [option])); } catch (_) {}
      if (!usableSnapshot(snapshot)) {
        try { snapshot = await Promise.resolve(callApi("getVariables", [option])); } catch (_) {}
      }
      if (token !== resourceRefreshToken || id !== textId(selectedId || writableId())) return;
      var root = usableSnapshot(snapshot) ? unwrapStat(snapshot) : null;
      paintSidecarResources(root && root["系统"], false);
    }

    function subscribeSidecarResourceEvents() {
      if (resourceEventsSubscribed) return;
      resourceEventsSubscribed = true;
      var found = findFunction("eventOn");
      if (!found) return;
      var events = [];
      var mvu = findMvu();
      try {
        events.push(mvu?.events?.VARIABLE_INITIALIZED, mvu?.events?.VARIABLE_UPDATE_ENDED);
      } catch (_) {}
      sourceWindows().forEach(function (view) {
        try {
          events.push(
            view.tavern_events?.CHAT_CHANGED,
            view.tavern_events?.MESSAGE_SWIPED,
            view.tavern_events?.CHARACTER_MESSAGE_RENDERED
          );
        } catch (_) {}
      });
      Array.from(new Set(events.filter(Boolean))).forEach(function (eventName) {
        var handler = function () { refreshSidecarResources(); };
        try {
          resourceEventStops.push({
            eventName: eventName,
            handler: handler,
            handle: found.fn.call(found.view, eventName, handler)
          });
        } catch (_) {}
      });
    }

    function snapshotExists(id, message) {
      var option = { type: "message", message_id: id };
      try {
        var mvu = callMvu("getMvuData", [option]);
        if (mvu && typeof mvu.then !== "function" && usableSnapshot(mvu)) return true;
      } catch (_) {}
      try {
        var vars = callApi("getVariables", [option]);
        if (vars && typeof vars.then !== "function" && usableSnapshot(vars)) return true;
      } catch (_) {}
      try {
        var swipeIndex = Number(message && (message.swipe_id !== undefined ? message.swipe_id : message.swipeId));
        var swipes = message && (message.swipes_data || message.swipe_data);
        if (Array.isArray(swipes) && usableSnapshot(swipes[Number.isFinite(swipeIndex) ? swipeIndex : 0])) return true;
        if (usableSnapshot(message && (message.variables || message.mvu || message.stat_data))) return true;
      } catch (_) {}
      return false;
    }

    function floorItems() {
      var messages = chatMessages();
      var result = [];
      messages.forEach(function (message, index) {
        if (isUserMessage(message, index)) return;
        var id = messageId(message, index);
        var swipe = Number(message && (message.swipe_id !== undefined ? message.swipe_id : message.swipeId));
        result.push({
          id: id,
          floor: index,
          swipe: Number.isFinite(swipe) ? swipe + 1 : 1,
          snapshot: snapshotExists(id, message)
        });
      });
      if (!result.length) {
        ownerOrder.forEach(function (id, index) {
          var owner = owners.get(id);
          if (ownerAlive(owner)) result.push({ id: id, floor: index, swipe: 1, snapshot: snapshotExists(id, null) });
        });
      }
      return result.slice(-4);
    }

    function mesIdFromElement(element) {
      var node = element && element.closest ? element.closest(".mes[mesid],[mesid],[data-message-id],[data-mes-id]") : null;
      if (!node) return "";
      return textId(node.getAttribute("mesid") || node.getAttribute("data-message-id") || node.getAttribute("data-mes-id"));
    }

    function nearestVisibleFloor() {
      var nodes = Array.prototype.slice.call(hostDocument.querySelectorAll(".mes[mesid],.mes[data-message-id],.mes[data-mes-id]"));
      if (!nodes.length) return "";
      var center = host.innerHeight / 2;
      var best = null;
      nodes.forEach(function (node) {
        var rect = node.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= host.innerHeight) return;
        var distance = Math.abs((rect.top + rect.bottom) / 2 - center);
        if (!best || distance < best.distance) best = { id: mesIdFromElement(node), distance: distance };
      });
      return best && best.id ? best.id : "";
    }

    function selectFloor(id, mode) {
      var next = textId(id) || writableId();
      if (!next) return;
      selectedId = next;
      if (mode) selectionMode = mode;
      saveUiState();
      updateChrome();
      refreshPhone();
      notifyStages();
    }

    function followVisibleFloor() {
      var visible = nearestVisibleFloor();
      var ids = floorItems().map(function (item) { return item.id; });
      selectFloor(ids.indexOf(visible) >= 0 ? visible : writableId(), "follow");
    }

    function readUiState() {
      try {
        return JSON.parse(host.localStorage.getItem(storageKey) || "{}") || {};
      } catch (_) { return {}; }
    }

    function loadUiState() {
      var saved = readUiState();
      selectionMode = saved && saved.mode === "manual" ? "manual" : "follow";
      if (saved && saved.selectedId) selectedId = textId(saved.selectedId);
      return saved;
    }

    function saveUiState() {
      try {
        var current = readUiState();
        host.localStorage.setItem(storageKey, JSON.stringify({
          mode: selectionMode,
          selectedId: selectedId,
          x: current.x,
          y: current.y,
          launcherX: current.launcherX,
          launcherY: current.launcherY
        }));
      } catch (_) {}
    }

    function savePosition(x, y) {
      try {
        var current = readUiState();
        host.localStorage.setItem(storageKey, JSON.stringify({
          mode: selectionMode,
          selectedId: selectedId,
          x: Math.round(x),
          y: Math.round(y),
          launcherX: current.launcherX,
          launcherY: current.launcherY
        }));
      } catch (_) {}
    }

    function saveLauncherPosition(x, y) {
      try {
        var current = readUiState();
        host.localStorage.setItem(storageKey, JSON.stringify({
          mode: selectionMode,
          selectedId: selectedId,
          x: current.x,
          y: current.y,
          launcherX: Math.round(x),
          launcherY: Math.round(y)
        }));
      } catch (_) {}
    }

    function panelSidecarReserve(width) {
      var available = Math.max(0, host.innerWidth - Number(width || 0) - 24);
      return Math.min(286, available);
    }

    function clampPosition(x, y) {
      var width = panel ? panel.offsetWidth : Math.min(760, host.innerWidth - 24);
      var height = panel ? panel.offsetHeight : Math.min(900, host.innerHeight - 24);
      var sidecar = panelSidecarReserve(width);
      return {
        x: Math.max(8, Math.min(Number(x) || 8, Math.max(8, host.innerWidth - width - sidecar - 8))),
        y: Math.max(8, Math.min(Number(y) || 8, Math.max(8, host.innerHeight - height - 8)))
      };
    }

    function clampLauncherPosition(x, y) {
      var width = launcher ? launcher.offsetWidth : 58;
      var height = launcher ? launcher.offsetHeight : 58;
      return {
        x: Math.max(8, Math.min(Number(x) || 8, Math.max(8, host.innerWidth - width - 8))),
        y: Math.max(8, Math.min(Number(y) || 8, Math.max(8, host.innerHeight - height - 8)))
      };
    }

    function applySavedPosition() {
      if (!panel) return;
      var saved = readUiState();
      var fallbackX = Math.max(8, host.innerWidth - panel.offsetWidth - panelSidecarReserve(panel.offsetWidth) - 28);
      var fallbackY = Math.max(8, Math.min(88, host.innerHeight - panel.offsetHeight - 8));
      var next = clampPosition(saved.x === undefined ? fallbackX : saved.x, saved.y === undefined ? fallbackY : saved.y);
      panel.style.left = next.x + "px";
      panel.style.top = next.y + "px";
    }

    function applySavedLauncherPosition() {
      if (!launcher) return;
      var saved = readUiState();
      var fallbackX = Math.max(8, host.innerWidth - launcher.offsetWidth - 22);
      var fallbackY = Math.max(8, host.innerHeight - launcher.offsetHeight - 90);
      var next = clampLauncherPosition(
        saved.launcherX === undefined ? fallbackX : saved.launcherX,
        saved.launcherY === undefined ? fallbackY : saved.launcherY
      );
      launcher.style.left = next.x + "px";
      launcher.style.top = next.y + "px";
      launcher.style.right = "auto";
      launcher.style.bottom = "auto";
    }

    function shellCss() {
      return [
        "*{box-sizing:border-box}",
        ".launcher{pointer-events:auto;position:fixed;right:22px;bottom:90px;width:58px;height:58px;border:1px solid rgba(196,116,255,.7);border-radius:22px;background:linear-gradient(145deg,#58115d,#19142d 62%,#0b1022);box-shadow:0 16px 44px rgba(20,0,35,.48),inset 0 1px rgba(255,255,255,.18);color:#fff;display:grid;place-items:center;cursor:grab;touch-action:none;user-select:none;z-index:3;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}",
        ".launcher:hover,.launcher.active{transform:translateY(-3px);border-color:rgba(244,186,255,.9);box-shadow:0 20px 52px rgba(74,18,91,.56),0 0 0 3px rgba(217,70,239,.12)}",
        ".launcher.dragging{cursor:grabbing;transition:none;transform:none}",
        ".launcher svg{width:28px;height:28px}.launcher i{position:absolute;right:-4px;top:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#f25aa6;color:white;font:800 11px/20px system-ui;text-align:center}",
        ".panel{pointer-events:auto;position:fixed;width:min(430px,calc(100vw - 16px));height:min(812px,calc(100vh - 16px));border:0;border-radius:38px;background:transparent;box-shadow:none;overflow:visible;z-index:2;display:none;isolation:isolate;--floor-sidecar-width:270px}",
        ".panel.open{display:block}",
        ".phone-wrap{position:absolute;inset:0;border:1px solid rgba(221,184,255,.42);border-radius:inherit;background:#05070f;box-shadow:0 32px 110px rgba(0,0,0,.72),0 0 0 6px rgba(17,12,30,.72);overflow:hidden;isolation:isolate}.phone-wrap:after{content:'';position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 1px rgba(255,255,255,.09);pointer-events:none;z-index:8}.phone{display:block;width:100%;height:100%;border:0;background:transparent}",
        ".encounter-detail-host{--ed-red:#ef1b2d;position:absolute;z-index:18;right:calc(100% + 16px);top:20px;width:500px;max-height:calc(100% - 40px);display:none;overflow:auto;pointer-events:auto;color:#fff;font-family:Impact,'Arial Black','Noto Sans SC',system-ui;filter:drop-shadow(0 28px 45px rgba(0,0,0,.5));scrollbar-width:thin;scrollbar-color:#ef1b2d #080808}.encounter-detail-host.open{display:block}.encounter-detail-host__frame{position:relative;min-height:620px;overflow:hidden;border:5px solid #080808;background:#f3eee4;clip-path:polygon(3% 0,100% 3%,97% 94%,86% 91%,79% 100%,4% 96%,0 12%);isolation:isolate}.encounter-detail-host__frame:before{content:'';position:absolute;inset:-20%;z-index:-3;background:repeating-linear-gradient(113deg,transparent 0 22px,rgba(0,0,0,.08) 23px 25px),radial-gradient(circle at 18% 22%,#ef1b2d 0 3%,transparent 3.3%),linear-gradient(145deg,#eee7dc 0 38%,#d9d1c6 38% 45%,#f7f3ea 45% 100%)}.encounter-detail-host__frame:after{content:'';position:absolute;z-index:-2;left:-18%;right:16%;bottom:-22%;height:66%;background:#080808;transform:rotate(-8deg);clip-path:polygon(0 12%,100% 0,86% 100%,8% 84%)}.encounter-detail-host__close{position:absolute;z-index:8;right:18px;top:18px;width:46px;height:42px;border:4px solid #080808;background:#ef1b2d;color:#fff;font:950 24px/1 Impact,'Arial Black',sans-serif;transform:rotate(3deg);cursor:pointer;box-shadow:6px 6px 0 #080808}.encounter-detail-host__kicker{display:inline-block;margin:28px 0 0 26px;padding:5px 18px;background:#080808;color:#fff;font:950 14px/1 Impact,'Arial Black','Noto Sans SC',sans-serif;letter-spacing:.12em;transform:rotate(-3deg);clip-path:polygon(4% 0,100% 8%,94% 100%,0 84%)}.encounter-detail-host__name{position:relative;z-index:2;margin:10px 58px 0 24px;color:#080808;font:950 clamp(30px,4vw,54px)/.92 Impact,'Arial Black','Noto Sans SC',sans-serif;letter-spacing:.02em;text-transform:uppercase;transform:rotate(-2deg);text-shadow:3px 3px 0 #fff,6px 6px 0 #ef1b2d;overflow-wrap:anywhere}.encounter-detail-host__alias{display:inline-block;margin:10px 0 0 32px;padding:5px 13px;background:#ef1b2d;color:#fff;font:900 13px/1.2 system-ui;transform:rotate(1deg)}.encounter-detail-host__visual{position:relative;height:285px;margin:8px 18px 0;overflow:hidden;clip-path:polygon(3% 8%,94% 0,100% 88%,8% 100%,0 55%);background:#080808}.encounter-detail-host__visual img{width:100%;height:100%;display:block;object-fit:cover;object-position:center 18%;filter:saturate(.8) contrast(1.14)}.encounter-detail-host__visual:after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,rgba(239,27,45,.45),transparent 34%,transparent 70%,rgba(0,0,0,.5)),repeating-linear-gradient(0deg,transparent 0 4px,rgba(255,255,255,.07) 5px);mix-blend-mode:screen;pointer-events:none}.encounter-detail-host__source{position:absolute;z-index:4;right:16px;bottom:18px;max-width:70%;padding:7px 13px;background:#fff;color:#080808;border:3px solid #080808;font:950 12px/1.2 system-ui;transform:rotate(-2deg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.encounter-detail-host__body{position:relative;z-index:3;margin:-18px 26px 30px;padding:22px 18px 18px;background:#ef1b2d;color:#fff;clip-path:polygon(0 7%,100% 0,96% 100%,5% 94%);transform:rotate(.5deg)}.encounter-detail-host__intro{margin:0 0 13px;font:750 13px/1.65 system-ui;white-space:pre-wrap}.encounter-detail-host__facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.encounter-detail-host__fact{min-width:0;padding:8px 9px;background:#080808;color:#fff;transform:skew(-4deg)}.encounter-detail-host__fact span{display:block;color:#ff9aa4;font:850 9px/1.2 system-ui;letter-spacing:.08em}.encounter-detail-host__fact strong{display:block;margin-top:3px;font:850 12px/1.3 system-ui;overflow-wrap:anywhere}.encounter-detail-host__thumbs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin:0 27px 28px}.encounter-detail-host__thumbs img{width:100%;aspect-ratio:1/1;object-fit:cover;border:3px solid #080808;background:#ddd;transform:rotate(var(--thumb-tilt,0deg))}.encounter-detail-host__empty{display:grid;height:100%;place-items:center;color:#fff;font:950 54px/1 Impact,sans-serif;background:repeating-linear-gradient(135deg,#080808 0 18px,#ef1b2d 19px 34px)}",
        ".encounter-detail-host{padding:6px 0 16px;overscroll-behavior:contain}.encounter-detail-host__frame{clip-path:polygon(1% 0,100% 1%,99% 98%,87% 97%,82% 100%,1% 99%,0 4%);padding-bottom:30px}.encounter-detail-host__body{margin:-10px 24px 22px;padding:34px 20px 30px;clip-path:polygon(0 2%,100% 0,98% 100%,2% 98%);transform:none}.encounter-detail-host__thumbs{margin-bottom:8px;padding-bottom:8px}",
        ".sidecar{position:absolute;z-index:12;left:calc(100% + 14px);top:12px;width:var(--floor-sidecar-width);display:grid;grid-template-columns:minmax(0,1fr);justify-items:start;gap:8px;pointer-events:none}",
        ".readonly{position:static;z-index:13;width:100%;padding:8px 10px;border-radius:13px;background:rgba(39,25,12,.72);border:1px solid rgba(251,191,36,.38);color:#fde68a;font:800 10px/1.35 system-ui;pointer-events:none;display:none;backdrop-filter:blur(10px)}.panel.history .readonly{display:block}",
        ".drag-edge{position:absolute;z-index:9;touch-action:none;user-select:none}.drag-edge.top{left:22px;right:22px;top:0;height:10px;cursor:grab}.drag-edge.bottom{left:22px;right:22px;bottom:0;height:10px;cursor:grab}.drag-edge.left{left:0;top:22px;bottom:22px;width:10px;cursor:grab}.drag-edge.right{right:0;top:22px;bottom:22px;width:10px;cursor:grab}.drag-edge:active,.drag-grip:active{cursor:grabbing}",
        ".drag-grip{position:absolute;z-index:10;left:50%;top:4px;width:72px;height:12px;transform:translateX(-50%);border-radius:999px;cursor:grab;touch-action:none;user-select:none}.drag-grip:after{content:'';position:absolute;left:18px;right:18px;top:4px;height:3px;border-radius:999px;background:rgba(235,216,248,.38);box-shadow:0 1px 6px rgba(0,0,0,.45)}",
        ".floor-toggle,.galgame-toggle{position:static;z-index:14;width:128px;min-width:128px;height:36px;padding:0 12px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;pointer-events:auto;backdrop-filter:blur(12px);font:800 11px/1 system-ui;white-space:nowrap;word-break:keep-all;overflow-wrap:normal;writing-mode:horizontal-tb;text-align:center;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.18)}",
        ".floor-toggle{border:1px solid rgba(224,188,255,.38);background:rgba(11,8,26,.38);color:#f7eafe}",
        ".galgame-toggle{border:1px solid rgba(148,163,184,.34);background:rgba(11,8,26,.38);color:#cbd5e1}.galgame-toggle.enabled{border-color:rgba(52,211,153,.5);background:rgba(6,78,59,.34);color:#a7f3d0}.galgame-toggle.disabled{border-color:rgba(251,113,133,.36);background:rgba(76,5,25,.3);color:#fecdd3}.galgame-toggle.busy,.galgame-toggle:disabled{cursor:wait;opacity:.72}",
        ".resource-panel{width:128px;display:grid;gap:5px;pointer-events:none}.resource-row{min-width:0;height:28px;padding:0 9px;border:1px solid rgba(148,163,184,.27);border-radius:10px;background:rgba(11,8,26,.42);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:space-between;gap:6px;color:#dbeafe;font:750 9px/1 system-ui;box-shadow:0 6px 18px rgba(0,0,0,.14)}.resource-row span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.resource-row strong{flex:0 0 auto;color:#fff;font:900 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.resource-row.money{border-color:rgba(251,191,36,.32);color:#fde68a}.resource-row.starlight{border-color:rgba(244,114,182,.32);color:#fbcfe8}.resource-row.energy{border-color:rgba(56,189,248,.32);color:#bae6fd}.resource-panel.loading .resource-row strong{opacity:.55}",
        ".galgame-dialog{position:absolute;z-index:30;inset:0;display:none;place-items:center;padding:22px;background:rgba(2,3,10,.64);backdrop-filter:blur(8px);pointer-events:auto}.galgame-dialog.open{display:grid}.galgame-dialog__card{width:min(340px,calc(100% - 20px));padding:20px;border:1px solid rgba(110,231,183,.36);border-radius:22px;background:linear-gradient(145deg,rgba(6,78,59,.96),rgba(10,14,31,.98) 68%);box-shadow:0 24px 70px rgba(0,0,0,.58);color:#ecfdf5;font-family:system-ui}.galgame-dialog.is-error .galgame-dialog__card{border-color:rgba(251,113,133,.46);background:linear-gradient(145deg,rgba(76,5,25,.96),rgba(10,14,31,.98) 68%)}.galgame-dialog__card strong{display:block;font:850 18px/1.3 system-ui}.galgame-dialog__card p{margin:12px 0 18px;color:rgba(236,253,245,.82);font:650 13px/1.65 system-ui;white-space:pre-wrap}.galgame-dialog__card button{width:100%;height:40px;border:1px solid rgba(167,243,208,.38);border-radius:13px;background:rgba(255,255,255,.1);color:#fff;font:800 13px system-ui;cursor:pointer}",
        ".floor-drawer{position:static;z-index:12;width:100%;display:none;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:0;border:0;border-radius:17px;background:transparent;backdrop-filter:none;box-shadow:none;color:#f8efff;pointer-events:auto}",
        ".floor-drawer.open{display:grid}.floor-title{grid-column:1/2;align-self:center;overflow:hidden;color:#d9cbe4;font:750 11px/1.2 system-ui;text-overflow:ellipsis;white-space:nowrap}",
        ".select{grid-column:1/-1;width:100%;height:38px;border:1px solid rgba(201,155,232,.34);border-radius:11px;background:rgba(24,21,43,.72);backdrop-filter:blur(10px);color:#f7effc;padding:0 31px 0 10px;font:700 11px system-ui}",
        ".mode{height:32px;padding:0 10px;border:1px solid rgba(201,155,232,.34);border-radius:10px;background:rgba(24,21,43,.5);backdrop-filter:blur(10px);color:#efe4f8;font:750 10px system-ui;cursor:pointer}",
        ".badge{grid-column:1/-1;min-height:28px;padding:6px 9px;border-radius:9px;display:flex;align-items:center;background:rgba(19,78,59,.32);backdrop-filter:blur(10px);border:1px solid rgba(51,211,153,.32);color:#a7f3d0;font:800 10px/1.25 system-ui}.badge.history{background:rgba(76,48,13,.34);border-color:rgba(251,191,36,.3);color:#fde68a}",
        "@media(max-width:980px){.encounter-detail-host{position:fixed;left:8px;right:auto;top:8px;width:min(440px,calc(100vw - 16px));max-height:calc(100vh - 16px)}}",
        "@media(max-width:760px){.panel{--floor-sidecar-width:clamp(104px,28vw,220px);width:min(430px,calc(100vw - var(--floor-sidecar-width) - 30px))}.sidecar{left:calc(100% + 10px)}.floor-toggle,.galgame-toggle,.resource-panel{width:min(128px,100%);min-width:0}.floor-toggle,.galgame-toggle{padding-inline:8px}.floor-drawer{grid-template-columns:minmax(0,1fr)}.floor-title,.mode,.select,.badge{grid-column:1/-1;width:100%}.encounter-detail-host__frame{min-height:560px}}"
      ].join("");
    }

    function hideEncounterDetail() {
      if (!encounterDetailHost) return;
      encounterDetailHost.classList.remove("open");
      encounterDetailHost.setAttribute("aria-hidden", "true");
      encounterDetailHost.innerHTML = "";
    }

    function showEncounterDetail(payload) {
      ensureShell();
      if (!encounterDetailHost) return false;
      var data = payload && typeof payload === "object" ? payload : {};
      var name = textId(data.name) || "未命名角色";
      var alias = textId(data.alias);
      var source = textId(data.source) || "角色库";
      var intro = textId(data.intro) || "暂无角色介绍。";
      var images = Array.isArray(data.images) ? data.images.map(textId).filter(Boolean).slice(0, 4) : [];
      var facts = Array.isArray(data.facts) ? data.facts.filter(function (item) {
        return item && typeof item === "object" && textId(item.value);
      }).slice(0, 10) : [];
      var hero = images[0]
        ? "<img src='" + escapeHtml(images[0]) + "' alt='" + escapeHtml(name) + "'>"
        : "<span class='encounter-detail-host__empty'>" + escapeHtml(name.slice(0, 1)) + "</span>";
      var factHtml = facts.map(function (item) {
        return "<div class='encounter-detail-host__fact'><span>" + escapeHtml(textId(item.label) || "资料") + "</span><strong>" + escapeHtml(textId(item.value)) + "</strong></div>";
      }).join("");
      var thumbs = images.length > 1
        ? "<div class='encounter-detail-host__thumbs'>" + images.map(function (image, index) {
            return "<img src='" + escapeHtml(image) + "' alt='" + escapeHtml(name + " 图片" + (index + 1)) + "' style='--thumb-tilt:" + (index % 2 ? "2deg" : "-2deg") + "'>";
          }).join("") + "</div>"
        : "";
      encounterDetailHost.innerHTML =
        "<section class='encounter-detail-host__frame' role='dialog' aria-modal='false' aria-label='" + escapeHtml(name + " 详情") + "'>" +
          "<button class='encounter-detail-host__close' type='button' aria-label='关闭角色详情'>×</button>" +
          "<span class='encounter-detail-host__kicker'>PERSONA FILE</span>" +
          "<h2 class='encounter-detail-host__name'>" + escapeHtml(name) + "</h2>" +
          (alias ? "<span class='encounter-detail-host__alias'>" + escapeHtml(alias) + "</span>" : "") +
          "<div class='encounter-detail-host__visual'>" + hero + "<span class='encounter-detail-host__source'>" + escapeHtml(source) + "</span></div>" +
          "<div class='encounter-detail-host__body'><p class='encounter-detail-host__intro'>" + escapeHtml(intro) + "</p><div class='encounter-detail-host__facts'>" + factHtml + "</div></div>" +
          thumbs +
        "</section>";
      encounterDetailHost.scrollTop = 0;
      encounterDetailHost.querySelector(".encounter-detail-host__close")?.addEventListener("click", hideEncounterDetail);
      encounterDetailHost.classList.add("open");
      encounterDetailHost.setAttribute("aria-hidden", "false");
      if (panel && host.innerWidth > 980) {
        var desiredWidth = Math.max(320, Math.min(520, host.innerWidth - panel.offsetWidth - panelSidecarReserve(panel.offsetWidth) - 44));
        encounterDetailHost.style.width = desiredWidth + "px";
        var rect = panel.getBoundingClientRect();
        if (rect.left < desiredWidth + 24) {
          var next = clampPosition(desiredWidth + 24, rect.top);
          panel.style.left = next.x + "px";
          panel.style.top = next.y + "px";
        }
      } else {
        encounterDetailHost.style.removeProperty("width");
      }
      return true;
    }

    function bridgePrelude() {
      var asset = JSON.stringify(config.assetBase);
      return "<script>(function(){var r=parent.__ST_HYPNOOS_FLOATING_SINGLETON__;window.__ST_HYPNOOS_FLOATING_PHONE__=true;window.__ST_HYPNOOS_FLOATING_REGISTRY__=r;window.__ST_HYPNOOS_ASSET_BASE__=" + asset + ";" +
        "function option(o){return r.normalizeMessageOption(o)}function writeOption(o){return r.normalizeWriteMessageOption(o)}" +
        "globalThis.getCurrentMessageId=function(){return r.getSelectedId()};" +
        "globalThis.__ST_HYPNOOS_REQUIRE_WRITABLE_FLOOR__=function(){if(r.isWritable())return true;r.notifyReadOnly();return false};" +
        "globalThis.getVariables=function(o){return r.readApi('getVariables',[option(o)])};" +
        "globalThis.updateVariablesWith=function(fn,o){return r.guardedApi('updateVariablesWith',[fn,writeOption(o)])};" +
        "globalThis.getChatMessages=function(){return r.callApi('getChatMessages',Array.prototype.slice.call(arguments))||[]};" +
        "globalThis.setChatMessages=function(){return r.guardedApi('setChatMessages',Array.prototype.slice.call(arguments))};" +
        "globalThis.getContext=function(){return r.getContext()};" +
        "globalThis.SillyTavern={getContext:function(){return r.getContext()},getCurrentChatId:function(){return r.getCurrentChatId()}};" +
        "var sourceMvu=r.getMvu();globalThis.Mvu={events:sourceMvu&&sourceMvu.events||{},getMvuData:function(o){return r.readMvu('getMvuData',[option(o)])},replaceMvuData:function(m,o){return r.guardedMvu('replaceMvuData',[m,writeOption(o)])},setMvuVariable:function(){return r.guardedMvu('setMvuVariable',Array.prototype.slice.call(arguments))}};" +
        "['eventOn','getCharWorldbookNames','getWorldbook'].forEach(function(n){globalThis[n]=function(){return r.callApi(n,Array.prototype.slice.call(arguments))}});" +
        "['createWorldbook','createWorldbookEntries','createWorldInfoEntry','replaceWorldbook','updateWorldbookWith'].forEach(function(n){globalThis[n]=function(){return r.guardedApi(n,Array.prototype.slice.call(arguments))}});" +
        "})();</scr" + "ipt>";
    }

    function mountPhone(force) {
      ensureShell();
      var currentWritable = writableId();
      if (!frame || (!force && frame.dataset.loadedFor === currentWritable)) return;
      if (!config.frontendUrl) return;
      frame.dataset.loadedFor = currentWritable;
      loadedForWritableId = currentWritable;
      try { fetchController?.abort?.(); } catch (_) {}
      fetchController = typeof host.AbortController === "function" ? new host.AbortController() : null;
      frame.removeAttribute("src");
      frame.srcdoc = "<!doctype html><html><head><meta charset='utf-8'><style>html,body{margin:0;min-height:100%;background:transparent}</style></head><body><main style='min-height:100vh;display:grid;place-items:center;background:#090b16;color:#dbc8e8;font:700 14px system-ui'>正在连接楼层变量…</main></body></html>";
      host.fetch(config.frontendUrl, { cache: "no-store", signal: fetchController && fetchController.signal }).then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.text();
      }).then(function (html) {
        if (loadedForWritableId !== currentWritable) return;
        var bridge = bridgePrelude();
        var next = /<head[^>]*>/i.test(html) ? html.replace(/<head([^>]*)>/i, "<head$1>" + bridge) : bridge + html;
        frame.srcdoc = next;
      }).catch(function (error) {
        if (error && error.name === "AbortError") return;
        frame.srcdoc = "<!doctype html><html><body style='margin:0;min-height:100vh;display:grid;place-items:center;background:#090b16;color:#fca5a5;font:700 14px/1.7 system-ui;padding:24px;text-align:center'>悬浮手机加载失败<br>" + escapeHtml(error && error.message) + "</body></html>";
      });
    }

    function scheduleMount(force) {
      if (mountTimer) host.clearTimeout(mountTimer);
      mountTimer = host.setTimeout(function () {
        mountTimer = 0;
        mountPhone(Boolean(force));
      }, 80);
    }

    function ensureShell() {
      if (shell && shell.isConnected) return;
      loadUiState();
      shell = hostDocument.createElement("div");
      shell.id = "hypnoos-floating-phone-host";
      shell.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147481900;";
      shadow = shell.attachShadow({ mode: "open" });
      shadow.innerHTML = "<style>" + shellCss() + "</style>" +
        "<button class='launcher' type='button' aria-label='打开悬浮手机'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8'><rect x='6' y='2.5' width='12' height='19' rx='3'/><path d='M10 5h4M11 18.5h2'/></svg><i>0</i></button>" +
        "<section class='panel' aria-label='HypnoOS 悬浮手机'><aside class='encounter-detail-host' aria-hidden='true'></aside><div class='phone-wrap'><iframe class='phone' title='HypnoOS 手机前端'></iframe><div class='galgame-dialog' role='dialog' aria-modal='true' aria-hidden='true' aria-labelledby='hypnoos-galgame-dialog-title'><section class='galgame-dialog__card'><strong id='hypnoos-galgame-dialog-title' data-galgame-dialog-title>Galgame人物演出</strong><p data-galgame-dialog-body></p><button type='button' data-galgame-dialog-close>知道了</button></section></div></div><span class='drag-edge top' data-phone-drag></span><span class='drag-edge right' data-phone-drag></span><span class='drag-edge bottom' data-phone-drag></span><span class='drag-edge left' data-phone-drag></span><span class='drag-grip' data-phone-drag aria-label='拖动手机'></span><aside class='sidecar'><button class='galgame-toggle' type='button' aria-pressed='false' disabled>Galgame --</button><section class='resource-panel loading' aria-label='当前楼层资源'><div class='resource-row money'><span>零花钱</span><strong data-resource-money>--</strong></div><div class='resource-row starlight'><span>星光点</span><strong data-resource-starlight>--</strong></div><div class='resource-row energy'><span>MC能量</span><strong data-resource-energy>--</strong></div></section><span class='readonly'>历史楼层 · 只读；切回当前楼后才能操作</span><button class='floor-toggle' type='button' aria-expanded='false'>楼层</button><section class='floor-drawer'><span class='floor-title'></span><button class='mode' type='button'>跟随视口</button><select class='select' aria-label='选择变量楼层'></select><span class='badge'></span></section></aside></section>";
      hostDocument.body.appendChild(shell);
      launcher = shadow.querySelector(".launcher");
      panel = shadow.querySelector(".panel");
      frame = shadow.querySelector(".phone");
      floorSelect = shadow.querySelector(".select");
      modeButton = shadow.querySelector(".mode");
      stateBadge = shadow.querySelector(".badge");
      titleFloor = shadow.querySelector(".floor-title");
      galgameToggle = shadow.querySelector(".galgame-toggle");
      galgameDialog = shadow.querySelector(".galgame-dialog");
      resourcePanel = shadow.querySelector(".resource-panel");
      encounterDetailHost = shadow.querySelector(".encounter-detail-host");
      galgameDialog?.querySelector("[data-galgame-dialog-close]")?.addEventListener("click", closeGalgameDialog);
      launcher.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (suppressLauncherClick) {
          suppressLauncherClick = false;
          return;
        }
        toggleShell(!shellOpen);
      });
      launcher.addEventListener("pointerdown", beginLauncherDrag);
      launcher.addEventListener("pointermove", moveLauncherDrag);
      launcher.addEventListener("pointerup", endLauncherDrag);
      launcher.addEventListener("pointercancel", cancelLauncherDrag);
      var floorToggle = shadow.querySelector(".floor-toggle");
      var floorDrawer = shadow.querySelector(".floor-drawer");
      floorToggle.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var nextOpen = !floorDrawer.classList.contains("open");
        floorDrawer.classList.toggle("open", nextOpen);
        floorToggle.setAttribute("aria-expanded", nextOpen ? "true" : "false");
      });
      galgameToggle.addEventListener("click", async function (event) {
        event.preventDefault();
        event.stopPropagation();
        var enabled = galgameToggle.getAttribute("aria-pressed") === "true";
        await setGalgameEnabled(!enabled);
      });
      modeButton.addEventListener("click", function () {
        if (selectionMode === "follow") {
          selectionMode = "manual";
          saveUiState();
          updateChrome();
        } else {
          followVisibleFloor();
        }
      });
      floorSelect.addEventListener("change", function () { selectFloor(floorSelect.value, "manual"); });
      shadow.querySelectorAll("[data-phone-drag]").forEach(function (handle) {
        handle.addEventListener("pointerdown", beginDrag);
      });
      frame.addEventListener("load", function () {
        consumePendingProfileRole();
        host.setTimeout(function () { notifyStages(); }, 0);
        host.setTimeout(function () { notifyStages(); }, 350);
      });
      applySavedLauncherPosition();
      applySavedPosition();
      updateChrome();
      syncGalgameState();
    }

    function beginLauncherDrag(event) {
      if (!launcher || (event.pointerType === "mouse" && event.button !== 0)) return;
      var rect = launcher.getBoundingClientRect();
      launcherDragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: rect.left,
        startTop: rect.top,
        moved: false
      };
      suppressLauncherClick = false;
      launcher.classList.add("dragging");
      try { launcher.setPointerCapture(event.pointerId); } catch (_) {}
      event.preventDefault();
      event.stopPropagation();
    }

    function moveLauncherDrag(event) {
      if (!launcherDragState || event.pointerId !== launcherDragState.pointerId) return;
      var dx = event.clientX - launcherDragState.startX;
      var dy = event.clientY - launcherDragState.startY;
      if (!launcherDragState.moved && Math.hypot(dx, dy) >= 5) launcherDragState.moved = true;
      if (launcherDragState.moved) {
        var next = clampLauncherPosition(launcherDragState.startLeft + dx, launcherDragState.startTop + dy);
        launcher.style.left = next.x + "px";
        launcher.style.top = next.y + "px";
        launcher.style.right = "auto";
        launcher.style.bottom = "auto";
      }
      event.preventDefault();
      event.stopPropagation();
    }

    function endLauncherDrag(event) {
      if (!launcherDragState || event.pointerId !== launcherDragState.pointerId) return;
      var ended = launcherDragState;
      launcherDragState = null;
      launcher.classList.remove("dragging");
      try {
        if (launcher.hasPointerCapture && launcher.hasPointerCapture(ended.pointerId)) launcher.releasePointerCapture(ended.pointerId);
      } catch (_) {}
      if (ended.moved) {
        var rect = launcher.getBoundingClientRect();
        saveLauncherPosition(rect.left, rect.top);
        suppressLauncherClick = true;
      }
      event.preventDefault();
      event.stopPropagation();
    }

    function cancelLauncherDrag(event) {
      if (!launcherDragState || event.pointerId !== launcherDragState.pointerId) return;
      launcherDragState = null;
      launcher.classList.remove("dragging");
      event.preventDefault();
      event.stopPropagation();
    }

    function beginDrag(event) {
      if (!panel || (event.pointerType === "mouse" && event.button !== 0) || event.target.closest("button,select")) return;
      event.preventDefault();
      event.stopPropagation();
      var rect = panel.getBoundingClientRect();
      dragState = {
        pointerId: event.pointerId,
        handle: event.currentTarget,
        dx: event.clientX - rect.left,
        dy: event.clientY - rect.top
      };
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) {}
      host.addEventListener("pointermove", moveDrag, true);
      host.addEventListener("pointerup", endDrag, true);
      host.addEventListener("pointercancel", endDrag, true);
    }

    function moveDrag(event) {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      event.preventDefault();
      var next = clampPosition(event.clientX - dragState.dx, event.clientY - dragState.dy);
      panel.style.left = next.x + "px";
      panel.style.top = next.y + "px";
    }

    function endDrag(event) {
      if (!dragState || (event && event.pointerId !== dragState.pointerId)) return;
      var ended = dragState;
      host.removeEventListener("pointermove", moveDrag, true);
      host.removeEventListener("pointerup", endDrag, true);
      host.removeEventListener("pointercancel", endDrag, true);
      try {
        if (ended.handle && ended.handle.hasPointerCapture && ended.handle.hasPointerCapture(ended.pointerId)) {
          ended.handle.releasePointerCapture(ended.pointerId);
        }
      } catch (_) {}
      var rect = panel.getBoundingClientRect();
      savePosition(rect.left, rect.top);
      dragState = null;
    }

    function toggleShell(open) {
      ensureShell();
      shellOpen = Boolean(open);
      panel.classList.toggle("open", shellOpen);
      launcher.setAttribute("aria-expanded", shellOpen ? "true" : "false");
      launcher.setAttribute("aria-label", shellOpen ? "关闭悬浮手机" : "打开悬浮手机");
      launcher.classList.toggle("active", shellOpen);
      if (shellOpen) {
        if (selectionMode === "follow") followVisibleFloor();
        else updateChrome();
        applySavedPosition();
        mountPhone(false);
        syncGalgameState();
      } else {
        hideEncounterDetail();
        var drawer = shadow.querySelector(".floor-drawer");
        var toggle = shadow.querySelector(".floor-toggle");
        if (drawer) drawer.classList.remove("open");
        if (toggle) toggle.setAttribute("aria-expanded", "false");
      }
    }

    function consumePendingProfileRole() {
      var name = textId(pendingProfileRole);
      if (!name) return true;
      try {
        var phoneWindow = frame && frame.contentWindow;
        var openProfile = phoneWindow && phoneWindow.__ST_OPEN_PROFILE_APP__;
        if (typeof openProfile !== "function") return false;
        pendingProfileRole = "";
        openProfile("clothing", name);
        return true;
      } catch (_) { return false; }
    }

    function schedulePendingProfileOpen(attempts) {
      if (profileOpenTimer) host.clearTimeout(profileOpenTimer);
      profileOpenTimer = 0;
      if (consumePendingProfileRole() || attempts <= 0) return;
      profileOpenTimer = host.setTimeout(function () {
        profileOpenTimer = 0;
        schedulePendingProfileOpen(attempts - 1);
      }, 100);
    }

    function openProfileRole(roleName) {
      pendingProfileRole = textId(roleName);
      if (!pendingProfileRole) return false;
      toggleShell(true);
      schedulePendingProfileOpen(20);
      return true;
    }

    function updateChrome() {
      ensureShell();
      var floors = floorItems();
      var ids = floors.map(function (item) { return item.id; });
      if (!selectedId || ids.indexOf(selectedId) < 0) selectedId = writableId() || (floors.length ? floors[floors.length - 1].id : "");
      floorSelect.innerHTML = floors.map(function (item) {
        var suffix = item.snapshot ? "有变量" : "无快照";
        var current = item.id === writableId() ? "当前" : "历史";
        return "<option value='" + escapeHtml(item.id) + "'>第 " + escapeHtml(item.floor) + " 楼 · 滑动" + escapeHtml(item.swipe) + " · " + current + " · " + suffix + "</option>";
      }).join("");
      floorSelect.value = selectedId;
      modeButton.textContent = selectionMode === "follow" ? "跟随视口" : "手动选楼";
      var writable = isWritable();
      stateBadge.textContent = writable ? "当前楼 · 可操作" : "历史楼 · 只读";
      stateBadge.classList.toggle("history", !writable);
      panel.classList.toggle("history", !writable);
      titleFloor.textContent = selectedId ? "楼层 " + selectedId : "等待楼层";
      var count = phoneApi("__ST_GET_PENDING_OPERATION_VIEW__", [], true);
      var note = phoneApi("__ST_GET_PENDING_OPERATION_NOTE__", [], true);
      var total = (Array.isArray(count) ? count.length : 0) + (String(note || "").trim() ? 1 : 0);
      var launcherBadge = shadow.querySelector(".launcher i");
      if (launcherBadge) launcherBadge.textContent = String(total);
      refreshSidecarResources();
    }

    function refreshPhone() {
      if (!frame || !frame.contentWindow) return;
      try {
        frame.contentWindow.dispatchEvent(new frame.contentWindow.CustomEvent("HYPNOOS_FLOATING_FLOOR_CHANGED", { detail: { messageId: selectedId, writable: isWritable() } }));
        frame.contentWindow.__ST_HYPNOOS_REFRESH_FRONTEND__ && frame.contentWindow.__ST_HYPNOOS_REFRESH_FRONTEND__();
      } catch (_) {}
    }

    function notifyReadOnly() {
      updateChrome();
      if (!panel || !shadow) return;
      var badge = shadow.querySelector(".readonly");
      if (!badge) return;
      badge.textContent = "历史楼层 · 只读；切回当前楼后才能操作";
      badge.animate([{ transform: "translateY(-3px)", opacity: .65 }, { transform: "translateY(0)", opacity: 1 }], { duration: 220 });
    }

    function phoneApi(name, args, quiet) {
      try {
        var phoneWindow = frame && frame.contentWindow;
        var fn = phoneWindow && phoneWindow[name];
        if (typeof fn === "function") return fn.apply(phoneWindow, Array.isArray(args) ? args : []);
      } catch (error) {
        if (!quiet) console.warn("[HypnoOS] 悬浮手机 API 调用失败", name, error);
      }
      return undefined;
    }

    function notifyStages() {
      updateChrome();
      stageSubscribers.forEach(function (subscriber) {
        try { subscriber(); } catch (_) {}
      });
    }

    function register(owner) {
      var id = textId(owner.messageId) || "unknown-" + token;
      var previousWritable = writableId();
      var existing = owners.get(id);
      owners.set(id, owner);
      if (!existing) ownerOrder.push(id);
	  else if (existing.token !== owner.token && ownerOrder.indexOf(id) < 0) ownerOrder.push(id);
      var nextWritable = writableId();
      if (!selectedId || selectionMode === "follow" || selectedId === previousWritable) selectedId = nextWritable;
      ensureShell();
      if (loadedForWritableId && previousWritable !== nextWritable) scheduleMount(true);
      else scheduleMount(false);
      updateChrome();
      notifyStages();
      // StatusPlaceHolder 的 stage iframe 只会在本楼最终正则 DOM 已经落地后注册。
      // 以这里作为确定性的正文最终化钩子，避免较早的 mutation/rAF 渲染
      // 又被酒馆随后一次 markdown/regex 整块重建覆盖。
      scheduleGalgameRender();
      scheduleActionFoldRender();
    }

    function unregister(id, ownerToken) {
      var current = owners.get(id);
      if (!current || current.token !== ownerToken) return;
      owners.delete(id);
      ownerOrder = ownerOrder.filter(function (item) { return item !== id; });
      if (selectionMode === "follow" || selectedId === id) selectedId = writableId();
      updateChrome();
      notifyStages();
    }

    hostClickHandler = function (event) {
      var path = [];
      try { path = typeof event.composedPath === "function" ? event.composedPath() : []; } catch (_) {}
      var portrait = path.find(function (node) {
        return node && node.nodeType === 1 && node.classList
          && node.classList.contains("st-galgame-card__portrait");
      });
      if (!portrait) {
        try { portrait = event.target && event.target.closest ? event.target.closest(".st-galgame-card__portrait") : null; } catch (_) {}
      }
      var card = portrait && portrait.closest
        ? portrait.closest(".st-galgame-card[data-galgame-role]")
        : null;
      var roleName = card
        && card.dataset.galgameUser !== "true"
        ? textId(card.dataset.galgameRole)
        : "";
      var id = mesIdFromElement(event.target);
      if (selectionMode === "follow" && id && floorItems().map(function (item) { return item.id; }).indexOf(id) >= 0) {
        selectFloor(id, "follow");
      }
      if (!roleName) return;
      event.preventDefault();
      event.stopPropagation();
      openProfileRole(roleName);
    };
    hostResizeHandler = function () {
      if (launcher) applySavedLauncherPosition();
      if (panel) applySavedPosition();
    };
    hostDocument.addEventListener("click", hostClickHandler, true);
    host.addEventListener("resize", hostResizeHandler, { passive: true });

    registryApi = {
      revision: config.revision,
      start: function () {
        ensureGalgameRenderer();
        ensureActionFoldRenderer();
        ensureShell();
        subscribeSidecarResourceEvents();
        if (!selectedId || selectionMode === "follow") selectedId = writableId();
        scheduleMount(false);
        updateChrome();
        syncGalgameState();
      },
      register: register,
      unregister: unregister,
      getSelectedId: function () { return selectedId || writableId(); },
      getWritableId: writableId,
      isWritable: isWritable,
      selectFloor: selectFloor,
      normalizeMessageOption: normalizeMessageOption,
      normalizeWriteMessageOption: normalizeWriteMessageOption,
      callApi: callApi,
      readApi: readApi,
      guardedApi: guardedApi,
      callMvu: callMvu,
      readMvu: readMvu,
      guardedMvu: guardedMvu,
      notifyReadOnly: notifyReadOnly,
      getMvu: findMvu,
      getContext: context,
      getCurrentChatId: function () {
        for (var i = 0; i < sourceWindows().length; i += 1) {
          try {
            var fn = sourceWindows()[i].SillyTavern && sourceWindows()[i].SillyTavern.getCurrentChatId;
            if (typeof fn === "function") return fn.call(sourceWindows()[i].SillyTavern);
          } catch (_) {}
        }
        return "";
      },
      phoneApi: phoneApi,
      notifyStages: notifyStages,
      registerGalgameHydrator: registerGalgameHydrator,
      refreshGalgameRole: refreshGalgameRole,
      renderGalgameMarkers: scheduleGalgameRender,
      renderActionFoldMarkers: scheduleActionFoldRender,
      subscribeStage: function (fn) { stageSubscribers.add(fn); return function () { stageSubscribers.delete(fn); }; },
      openPhone: function () { toggleShell(true); },
      openProfileRole: openProfileRole,
      showEncounterDetail: showEncounterDetail,
      hideEncounterDetail: hideEncounterDetail,
      updateChrome: updateChrome,
      destroy: function () {
        if (mountTimer) host.clearTimeout(mountTimer);
        mountTimer = 0;
        if (profileOpenTimer) host.clearTimeout(profileOpenTimer);
        profileOpenTimer = 0;
        pendingProfileRole = "";
        resourceRefreshToken += 1;
        resourceEventStops.splice(0).forEach(function (item) {
          try {
            if (typeof item.handle === "function") item.handle();
            else item.handle?.stop?.() || item.handle?.unsubscribe?.() || item.handle?.off?.();
            var off = findFunction("eventOff");
            if (off) off.fn.call(off.view, item.eventName, item.handler);
          } catch (_) {}
        });
        resourceEventsSubscribed = false;
        try { fetchController?.abort?.(); } catch (_) {}
        fetchController = null;
        try { galgameObserver && galgameObserver.disconnect(); } catch (_) {}
        galgameObserver = null;
        try { actionFoldObserver && actionFoldObserver.disconnect(); } catch (_) {}
        actionFoldObserver = null;
        if (galgameRenderFrame) {
          try {
            if (host.cancelAnimationFrame) host.cancelAnimationFrame(galgameRenderFrame);
            else host.clearTimeout(galgameRenderFrame);
          } catch (_) {}
        }
        galgameRenderFrame = 0;
        if (actionFoldRenderFrame) {
          try {
            if (host.cancelAnimationFrame) host.cancelAnimationFrame(actionFoldRenderFrame);
            else host.clearTimeout(actionFoldRenderFrame);
          } catch (_) {}
        }
        actionFoldRenderFrame = 0;
        galgameHydrator = null;
        galgameHydratorToken = "";
        hideEncounterDetail();
        encounterDetailHost = null;
        resourcePanel = null;
        try {
          if (hostDocument[GALGAME_RUNTIME_KEY] && hostDocument[GALGAME_RUNTIME_KEY].registry === registryApi) {
            delete hostDocument[GALGAME_RUNTIME_KEY];
          }
        } catch (_) {}
        try { hostDocument.removeEventListener("click", hostClickHandler, true); } catch (_) {}
        try { host.removeEventListener("resize", hostResizeHandler); } catch (_) {}
        try { host.removeEventListener("pointermove", moveDrag, true); } catch (_) {}
        try { host.removeEventListener("pointerup", endDrag, true); } catch (_) {}
        try { host.removeEventListener("pointercancel", endDrag, true); } catch (_) {}
        try { shell?.remove?.(); } catch (_) {}
        stageSubscribers.clear();
        owners.clear();
        ownerOrder = [];
      }
    };
    return registryApi;
  }

  function ensureRegistry(host) {
    try {
      var existing = host.__ST_HYPNOOS_FLOATING_SINGLETON__;
      if (existing && existing.revision === config.revision) return existing;
      if (existing && existing.destroy) existing.destroy();
      var created = createRegistry(host);
      host.__ST_HYPNOOS_FLOATING_SINGLETON__ = created;
      return created;
    } catch (error) {
      console.error("[HypnoOS] 无法创建悬浮手机", error);
      return null;
    }
  }

  function stageCss() {
    return [
      "html,body{margin:0;background:transparent!important;color:inherit}body{padding:0!important}",
      ".stage{margin:10px 0;border:1px solid rgba(148,163,184,.2);border-radius:22px;background:radial-gradient(circle at 90% -10%,rgba(139,92,246,.2),transparent 38%),linear-gradient(155deg,rgba(15,23,42,.97),rgba(3,7,18,.95));box-shadow:0 16px 38px rgba(2,6,23,.28),inset 0 1px rgba(255,255,255,.07);color:#f8fafc;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden}",
      ".head{display:flex;align-items:center;gap:9px;padding:13px 14px;border-bottom:1px solid rgba(148,163,184,.12)}.head-title{display:grid;gap:2px}.head-title strong{font-size:14px}.head-title small{color:rgba(196,181,253,.68);font-size:10px;font-weight:800}.grow{flex:1}",
      ".open{border:1px solid rgba(167,139,250,.28);border-radius:11px;background:rgba(139,92,246,.11);color:#ddd6fe;font:800 11px system-ui;padding:7px 10px;cursor:pointer}.status{padding:4px 8px;border:1px solid rgba(52,211,153,.2);border-radius:999px;background:rgba(16,185,129,.1);color:#a7f3d0;font:850 9px system-ui}.status.history{border-color:rgba(251,191,36,.2);background:rgba(245,158,11,.1);color:#fde68a}",
      ".body{padding:11px 12px 12px}.empty{padding:18px;border:1px dashed rgba(167,139,250,.24);border-radius:15px;text-align:center;color:rgba(203,213,225,.62);font-size:11px;line-height:1.6;background:rgba(139,92,246,.05)}.empty.waiting{animation:stagePulse 1.6s ease-in-out infinite}@keyframes stagePulse{50%{border-color:rgba(56,189,248,.42);color:#bae6fd}}",
      ".list{display:grid;gap:8px;max-height:300px;overflow:auto;scrollbar-width:thin}.item{--accent:#94a3b8;--soft:rgba(148,163,184,.09);position:relative;display:grid;grid-template-columns:32px minmax(0,1fr);gap:9px;padding:10px;border:1px solid color-mix(in srgb,var(--accent) 25%,transparent);border-radius:15px;background:linear-gradient(135deg,var(--soft),rgba(255,255,255,.035));overflow:hidden}.item:before{content:'';position:absolute;inset:0 auto 0 0;width:3px;background:var(--accent)}.item.tone-hypnosis{--accent:#c084fc;--soft:rgba(168,85,247,.12)}.item.tone-reward{--accent:#fbbf24;--soft:rgba(245,158,11,.11)}.item.tone-schedule{--accent:#22d3ee;--soft:rgba(6,182,212,.1)}.item.tone-location{--accent:#60a5fa;--soft:rgba(59,130,246,.1)}.item.tone-profile{--accent:#f472b6;--soft:rgba(236,72,153,.1)}.item.tone-activity{--accent:#34d399;--soft:rgba(16,185,129,.1)}.item.tone-inventory{--accent:#fb923c;--soft:rgba(249,115,22,.1)}.item.is-locked{--accent:#38bdf8;--soft:rgba(14,165,233,.12);border-color:rgba(56,189,248,.34)}",
      ".item-icon{width:32px;height:32px;border:1px solid color-mix(in srgb,var(--accent) 34%,transparent);border-radius:11px;background:color-mix(in srgb,var(--accent) 11%,rgba(2,6,23,.7));color:var(--accent);display:grid;place-items:center;font-weight:950}.item-content{min-width:0;display:grid;gap:5px}.item-top{display:flex;align-items:center;gap:6px}.item-source{min-width:0;padding:2px 6px;border-radius:999px;background:color-mix(in srgb,var(--accent) 12%,transparent);color:color-mix(in srgb,var(--accent) 76%,white);font-size:9px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.item-state{margin-left:auto;color:rgba(203,213,225,.5);font-size:9px;font-weight:850;white-space:nowrap}.item.is-locked .item-state{color:#bae6fd}.item h3{margin:0;color:#f8fafc;font-size:12px;line-height:1.35}.item p{margin:0;color:rgba(226,232,240,.68);font-size:10px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}.item-remove{position:absolute;right:8px;bottom:8px;width:24px;height:24px;border:1px solid rgba(244,63,94,.25);border-radius:9px;background:rgba(244,63,94,.1);color:#fecdd3;font-size:15px;cursor:pointer}.item-remove:disabled{border-color:rgba(56,189,248,.2);background:rgba(14,165,233,.08);color:#bae6fd;font-size:11px;cursor:not-allowed}",
      ".item-detail{border-top:1px solid rgba(148,163,184,.1);padding-top:5px;margin-right:30px}.item-detail summary{cursor:pointer;list-style:none;color:rgba(203,213,225,.56);font-size:9px;font-weight:900}.item-detail summary::-webkit-details-marker{display:none}.detail-list{margin-top:6px;display:grid;gap:4px}.detail-row{display:grid;grid-template-columns:minmax(62px,.38fr) minmax(0,1fr);gap:7px;padding:5px 6px;border-radius:8px;background:rgba(2,6,23,.28);font-size:9px;line-height:1.4}.detail-row b{color:var(--accent);overflow-wrap:anywhere}.detail-row span{color:rgba(226,232,240,.7);white-space:pre-wrap;overflow-wrap:anywhere}",
      ".note{box-sizing:border-box;width:100%;min-height:68px;margin-top:10px;padding:9px 10px;resize:vertical;border:1px solid rgba(148,163,184,.16);border-radius:13px;background:rgba(2,6,23,.42);color:#e2e8f0;font:11px/1.55 system-ui;outline:none}.note:focus{border-color:rgba(56,189,248,.45);box-shadow:0 0 0 3px rgba(56,189,248,.1)}.actions{display:flex;align-items:center;gap:7px;margin-top:9px}.actions label{margin-right:auto;color:rgba(203,213,225,.62);font-size:10px}.actions button{border:1px solid rgba(148,163,184,.18);border-radius:11px;background:rgba(255,255,255,.06);color:#cbd5e1;font:850 10px system-ui;padding:8px 10px;cursor:pointer}.actions .send{background:linear-gradient(135deg,#7c3aed,#db2777);color:white;border-color:transparent}.actions button:disabled,.note:disabled{opacity:.45;cursor:not-allowed}",
      ".modal{position:fixed;inset:0;z-index:10;display:grid;place-items:center;background:rgba(2,6,23,.68);backdrop-filter:blur(7px);padding:14px}.modal-card{max-width:360px;border:1px solid rgba(148,163,184,.2);border-radius:18px;background:#111827;color:#e5e7eb;padding:18px;box-shadow:0 22px 64px rgba(0,0,0,.4)}.modal-card p{font-size:12px;line-height:1.65;color:#94a3b8}.modal-card div{display:flex;justify-content:flex-end;gap:8px}.modal-card button{border:1px solid rgba(148,163,184,.2);border-radius:10px;background:#1f2937;color:#e5e7eb;padding:8px 11px;font-weight:800}.modal-card .danger{background:#be123c;color:white;border-color:transparent}"
    ].join("");
  }

  function stageVisual(item) {
    var allowed = ["hypnosis", "reward", "schedule", "location", "profile", "activity", "inventory", "system"];
    var tone = allowed.indexOf(String(item && item.tone || "")) >= 0 ? String(item.tone) : "system";
    return {
      tone: tone,
      icon: String(item && item.icon || "◆"),
      state: item && item.locked ? "🔒 已锁定" : "可撤销"
    };
  }

  function stageDetailsHtml(item) {
    var details = Array.isArray(item && item.details) ? item.details.filter(function (entry) {
      return entry && entry.label && entry.value;
    }) : [];
    if (!details.length) return "";
    var rows = details.map(function (entry) {
      return "<div class='detail-row'><b>" + escapeHtml(entry.label) + "</b><span>" + escapeHtml(entry.value) + "</span></div>";
    }).join("");
    return "<details class='item-detail'><summary>查看完整内容 · " + details.length + " 项</summary><div class='detail-list'>" + rows + "</div></details>";
  }

  function renderStage(registry, root, messageId) {
    var writable = registry.getWritableId() === messageId;
    var selectedWritable = registry.isWritable();
    var views = registry.phoneApi("__ST_GET_PENDING_OPERATION_VIEW__", [], true);
    var note = registry.phoneApi("__ST_GET_PENDING_OPERATION_NOTE__", [], true);
    var keep = registry.phoneApi("__ST_READ_OPERATION_KEEP_AFTER_FLUSH__", [], true);
    var ready = Array.isArray(views);
    views = ready ? views : [];
    var body = "";
    if (!writable) {
      body = "<div class='empty'>此楼只保留历史占位。可打开悬浮手机查看该楼变量；暂存操作只在当前楼编辑。</div>";
    } else if (!ready) {
      body = "<div class='empty'>悬浮手机正在连接暂存队列…</div>";
    } else {
      var list = views.length ? "<div class='list'>" + views.map(function (item) {
        var visual = stageVisual(item);
        return "<article class='item tone-" + visual.tone + (item.locked ? " is-locked" : "") + "'>" +
          "<span class='item-icon' aria-hidden='true'>" + escapeHtml(visual.icon) + "</span>" +
          "<div class='item-content'><div class='item-top'><span class='item-source'>" + escapeHtml(item.source || "APP") + "</span><span class='item-state'>" + escapeHtml(visual.state) + "</span></div>" +
          "<h3>" + escapeHtml(item.action || "操作") + "</h3><p>" + escapeHtml(item.summary || "无附加信息") + "</p>" + stageDetailsHtml(item) + "</div>" +
          "<button class='item-remove' type='button' data-remove='" + escapeHtml(item.id || item.key) + "' " + (item.locked ? "disabled title='锁定操作'" : "title='移除'") + ">" + (item.locked ? "🔒" : "×") + "</button></article>";
      }).join("") + "</div>" : "<div class='empty'>还没有本轮操作。手机中的命令、任务与购买会先暂存在这里。</div>";
      body = list + "<textarea class='note' placeholder='写给 AI 的普通备注，不会替代前端操作。'>" + escapeHtml(note || "") + "</textarea>" +
        "<div class='actions'><label><input class='keep' type='checkbox' " + (keep ? "checked" : "") + "> 确认后保留</label><button type='button' data-clear>清空</button><button class='send' type='button' data-flush>写入输入框</button></div>";
    }
    var lockedCount = views.filter(function (item) { return Boolean(item && item.locked); }).length;
    root.innerHTML = "<section class='stage'><header class='head'><div class='head-title'><strong>本轮操作暂存</strong><small>共 " + views.length + " 条" + (lockedCount ? " · " + lockedCount + " 条已锁定" : "") + "</small></div><span class='grow'></span><span class='status " + (writable && selectedWritable ? "" : "history") + "'>" + (writable ? (selectedWritable ? "当前楼" : "手机正查看历史") : "历史楼") + "</span><button class='open' type='button'>打开手机</button></header><div class='body'>" + body + "</div></section>";
    root.querySelector(".open").addEventListener("click", function () { registry.openPhone(); });
    var noteInput = root.querySelector(".note");
    if (noteInput) {
      noteInput.addEventListener("input", function () { registry.phoneApi("__ST_SET_PENDING_OPERATION_NOTE__", [noteInput.value, { emit: false }]); });
      noteInput.addEventListener("change", function () { registry.phoneApi("__ST_SET_PENDING_OPERATION_NOTE__", [noteInput.value]); });
    }
    var keepInput = root.querySelector(".keep");
    if (keepInput) keepInput.addEventListener("change", function () { registry.phoneApi("__ST_WRITE_OPERATION_KEEP_AFTER_FLUSH__", [keepInput.checked]); registry.notifyStages(); });
    root.querySelectorAll("[data-remove]").forEach(function (button) {
      button.addEventListener("click", function () { registry.phoneApi("__ST_REMOVE_PENDING_OPERATION__", [button.dataset.remove]); registry.notifyStages(); });
    });
    var flush = root.querySelector("[data-flush]");
    if (flush) flush.addEventListener("click", function () { registry.phoneApi("__ST_FLUSH_OPERATION_TO_INPUT__", []); });
    var clear = root.querySelector("[data-clear]");
    if (clear) clear.addEventListener("click", function () {
      showStageConfirm(root, "清空未锁定的暂存内容？", "锁定操作仍会保留；普通操作和备注将不会写入本轮输入。", function () {
        registry.phoneApi("__ST_CLEAR_OPERATION_INPUT_LOG__", []);
        registry.notifyStages();
      });
    });
  }

  function showStageConfirm(root, title, message, confirm) {
    var modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = "<section class='modal-card'><strong>" + escapeHtml(title) + "</strong><p>" + escapeHtml(message) + "</p><div><button type='button' data-cancel>取消</button><button class='danger' type='button' data-confirm>确认</button></div></section>";
    modal.addEventListener("click", function (event) { if (event.target === modal || event.target.closest("[data-cancel]")) modal.remove(); });
    modal.querySelector("[data-confirm]").addEventListener("click", function () { modal.remove(); confirm(); });
    root.appendChild(modal);
  }

  var host = findHostWindow();
  if (config.mode === "host") {
    var hostRegistry = ensureRegistry(host);
    if (!hostRegistry) return;
    hostRegistry.start();
    try {
      host.dispatchEvent(new host.CustomEvent("HYPNOOS_FLOATING_REGISTRY_READY", { detail: { revision: config.revision } }));
    } catch (_) {}
    return;
  }

  document.documentElement.dataset.hypnoosStagingOnly = "true";
  var style = document.createElement("style");
  style.textContent = stageCss();
  document.head.appendChild(style);
  var root = document.createElement("div");
  root.id = "hypnoos-operation-placeholder";
  document.body.replaceChildren(root, script);

  var stageAttached = false;
  var unsubscribe = function () {};
  var ownMessageId = "";
  function attachStage(registry) {
    if (stageAttached || !registry) return;
    stageAttached = true;
    ownMessageId = messageIdFromWindow() || registry.getWritableId() || "current";
    registry.register({ token: token, messageId: ownMessageId, view: window, config: config });
    unsubscribe = registry.subscribeStage(function () { renderStage(registry, root, ownMessageId); });
    renderStage(registry, root, ownMessageId);
  }
  function registryReady() {
    try {
      var registry = host.__ST_HYPNOOS_FLOATING_SINGLETON__;
      if (registry && registry.revision === config.revision) attachStage(registry);
    } catch (_) {}
  }
  registryReady();
  if (!stageAttached) {
    root.innerHTML = "<section class='stage'><div class='empty waiting'>酒馆助手正在启动悬浮手机与暂存队列…</div></section>";
    try { host.addEventListener("HYPNOOS_FLOATING_REGISTRY_READY", registryReady); } catch (_) {}
  }

  window.addEventListener("pagehide", function () {
    try { host.removeEventListener("HYPNOOS_FLOATING_REGISTRY_READY", registryReady); } catch (_) {}
    try { unsubscribe(); } catch (_) {}
    try { host.__ST_HYPNOOS_FLOATING_SINGLETON__?.unregister?.(ownMessageId, token); } catch (_) {}
  }, { once: true });
})();
