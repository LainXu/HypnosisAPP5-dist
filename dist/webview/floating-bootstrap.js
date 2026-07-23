(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var config = {
    frontendUrl: String(script.dataset.frontendUrl || ""),
    assetBase: String(script.dataset.assetBase || ""),
    revision: String(script.dataset.revision || "local")
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
    var selectedId = "";
    var selectionMode = "follow";
    var loadedForWritableId = "";
    var dragState = null;
    var stageSubscribers = new Set();
    var shellOpen = false;
    var storageKey = "hypnoos.floatingPhone.ui.v1";
    var mountTimer = 0;
    var profileOpenTimer = 0;
    var pendingProfileRole = "";
    var fetchController = null;
    var hostClickHandler = null;
    var hostResizeHandler = null;

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
      return result;
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
          y: current.y
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
          y: Math.round(y)
        }));
      } catch (_) {}
    }

    function clampPosition(x, y) {
      var width = panel ? panel.offsetWidth : Math.min(760, host.innerWidth - 24);
      var height = panel ? panel.offsetHeight : Math.min(900, host.innerHeight - 24);
      return {
        x: Math.max(8, Math.min(Number(x) || 8, Math.max(8, host.innerWidth - width - 8))),
        y: Math.max(8, Math.min(Number(y) || 8, Math.max(8, host.innerHeight - height - 8)))
      };
    }

    function applySavedPosition() {
      if (!panel) return;
      var saved = readUiState();
      var fallbackX = Math.max(8, host.innerWidth - panel.offsetWidth - 28);
      var fallbackY = Math.max(8, Math.min(88, host.innerHeight - panel.offsetHeight - 8));
      var next = clampPosition(saved.x === undefined ? fallbackX : saved.x, saved.y === undefined ? fallbackY : saved.y);
      panel.style.left = next.x + "px";
      panel.style.top = next.y + "px";
    }

    function shellCss() {
      return [
        "*{box-sizing:border-box}",
        ".launcher{pointer-events:auto;position:fixed;right:22px;bottom:90px;width:58px;height:58px;border:1px solid rgba(196,116,255,.7);border-radius:22px;background:linear-gradient(145deg,#58115d,#19142d 62%,#0b1022);box-shadow:0 16px 44px rgba(20,0,35,.48),inset 0 1px rgba(255,255,255,.18);color:#fff;display:grid;place-items:center;cursor:pointer;z-index:3;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}",
        ".launcher:hover,.launcher.active{transform:translateY(-3px);border-color:rgba(244,186,255,.9);box-shadow:0 20px 52px rgba(74,18,91,.56),0 0 0 3px rgba(217,70,239,.12)}",
        ".launcher svg{width:28px;height:28px}.launcher i{position:absolute;right:-4px;top:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#f25aa6;color:white;font:800 11px/20px system-ui;text-align:center}",
        ".panel{pointer-events:auto;position:fixed;width:min(430px,calc(100vw - 16px));height:min(812px,calc(100vh - 16px));border:1px solid rgba(221,184,255,.42);border-radius:38px;background:#05070f;box-shadow:0 32px 110px rgba(0,0,0,.72),0 0 0 6px rgba(17,12,30,.72);overflow:hidden;z-index:2;display:none;isolation:isolate}",
        ".panel.open{display:block}.panel:after{content:'';position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 1px rgba(255,255,255,.09);pointer-events:none;z-index:8}",
        ".phone-wrap{position:absolute;inset:0;background:#05070f}.phone{display:block;width:100%;height:100%;border:0;background:transparent}",
        ".readonly{position:absolute;right:12px;top:58px;z-index:7;padding:7px 10px;border-radius:999px;background:rgba(39,25,12,.92);border:1px solid rgba(251,191,36,.38);color:#fde68a;font:800 10px system-ui;pointer-events:none;display:none}.phone-wrap.history .readonly{display:block}",
        ".drag-edge{position:absolute;z-index:9;touch-action:none;user-select:none}.drag-edge.top{left:22px;right:22px;top:0;height:10px;cursor:grab}.drag-edge.bottom{left:22px;right:22px;bottom:0;height:10px;cursor:grab}.drag-edge.left{left:0;top:22px;bottom:22px;width:10px;cursor:grab}.drag-edge.right{right:0;top:22px;bottom:22px;width:10px;cursor:grab}.drag-edge:active,.drag-grip:active{cursor:grabbing}",
        ".drag-grip{position:absolute;z-index:10;left:50%;top:4px;width:72px;height:12px;transform:translateX(-50%);border-radius:999px;cursor:grab;touch-action:none;user-select:none}.drag-grip:after{content:'';position:absolute;left:18px;right:18px;top:4px;height:3px;border-radius:999px;background:rgba(235,216,248,.38);box-shadow:0 1px 6px rgba(0,0,0,.45)}",
        ".floor-toggle{position:absolute;z-index:11;right:11px;top:12px;height:31px;padding:0 10px;border:1px solid rgba(224,188,255,.28);border-radius:999px;background:rgba(11,8,26,.76);backdrop-filter:blur(12px);color:#f7eafe;font:800 10px system-ui;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.24)}",
        ".floor-drawer{position:absolute;z-index:12;left:12px;right:12px;top:49px;display:none;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:10px;border:1px solid rgba(220,184,255,.3);border-radius:17px;background:linear-gradient(135deg,rgba(20,13,38,.94),rgba(8,12,28,.94));backdrop-filter:blur(18px);box-shadow:0 18px 42px rgba(0,0,0,.42);color:#f8efff}",
        ".floor-drawer.open{display:grid}.floor-title{grid-column:1/2;align-self:center;overflow:hidden;color:#d9cbe4;font:750 11px/1.2 system-ui;text-overflow:ellipsis;white-space:nowrap}",
        ".select{grid-column:1/-1;width:100%;height:35px;border:1px solid rgba(201,155,232,.3);border-radius:11px;background:#18152b;color:#f7effc;padding:0 31px 0 10px;font:700 11px system-ui}",
        ".mode{height:30px;padding:0 9px;border:1px solid rgba(201,155,232,.3);border-radius:10px;background:rgba(255,255,255,.06);color:#efe4f8;font:750 10px system-ui;cursor:pointer}",
        ".badge{grid-column:1/-1;min-height:25px;padding:5px 8px;border-radius:9px;display:flex;align-items:center;background:rgba(51,211,153,.12);border:1px solid rgba(51,211,153,.32);color:#a7f3d0;font:800 10px/1.25 system-ui}.badge.history{background:rgba(251,191,36,.1);border-color:rgba(251,191,36,.3);color:#fde68a}",
        "@media(max-width:500px){.panel{width:calc(100vw - 8px);height:calc(100vh - 8px);border-radius:27px;box-shadow:0 24px 80px rgba(0,0,0,.7),0 0 0 3px rgba(17,12,30,.72)}.launcher{right:14px;bottom:78px}.floor-toggle{right:8px;top:9px}.floor-drawer{left:8px;right:8px;top:44px}}"
      ].join("");
    }

    function bridgePrelude() {
      var asset = JSON.stringify(config.assetBase);
      return "<script>(function(){var r=parent.__ST_HYPNOOS_FLOATING_SINGLETON__;window.__ST_HYPNOOS_FLOATING_PHONE__=true;window.__ST_HYPNOOS_FLOATING_REGISTRY__=r;window.__ST_HYPNOOS_ASSET_BASE__=" + asset + ";" +
        "function option(o){return r.normalizeMessageOption(o)}function writeOption(o){return r.normalizeWriteMessageOption(o)}" +
        "globalThis.getCurrentMessageId=function(){return r.getSelectedId()};" +
        "globalThis.getVariables=function(o){return r.readApi('getVariables',[option(o)])};" +
        "globalThis.updateVariablesWith=function(fn,o){return r.guardedApi('updateVariablesWith',[fn,writeOption(o)])};" +
        "globalThis.getChatMessages=function(){return r.callApi('getChatMessages',Array.prototype.slice.call(arguments))||[]};" +
        "globalThis.setChatMessages=function(){return r.guardedApi('setChatMessages',Array.prototype.slice.call(arguments))};" +
        "globalThis.getContext=function(){return r.getContext()};" +
        "globalThis.SillyTavern={getContext:function(){return r.getContext()},getCurrentChatId:function(){return r.getCurrentChatId()}};" +
        "var sourceMvu=r.getMvu();globalThis.Mvu={events:sourceMvu&&sourceMvu.events||{},getMvuData:function(o){return r.readMvu('getMvuData',[option(o)])},replaceMvuData:function(m,o){return r.guardedMvu('replaceMvuData',[m,writeOption(o)])},setMvuVariable:function(){return r.guardedMvu('setMvuVariable',Array.prototype.slice.call(arguments))}};" +
        "['eventOn','getCharWorldbookNames','getWorldbook'].forEach(function(n){globalThis[n]=function(){return r.callApi(n,Array.prototype.slice.call(arguments))}});" +
        "['createWorldbook','createWorldbookEntries','createWorldInfoEntry'].forEach(function(n){globalThis[n]=function(){return r.guardedApi(n,Array.prototype.slice.call(arguments))}});" +
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
        "<section class='panel' aria-label='HypnoOS 悬浮手机'><div class='phone-wrap'><span class='readonly'>历史楼层 · 只读</span><iframe class='phone' title='HypnoOS 手机前端'></iframe></div><span class='drag-edge top' data-phone-drag></span><span class='drag-edge right' data-phone-drag></span><span class='drag-edge bottom' data-phone-drag></span><span class='drag-edge left' data-phone-drag></span><span class='drag-grip' data-phone-drag aria-label='拖动手机'></span><button class='floor-toggle' type='button' aria-expanded='false'>楼层</button><section class='floor-drawer'><span class='floor-title'></span><button class='mode' type='button'>跟随视口</button><select class='select' aria-label='选择变量楼层'></select><span class='badge'></span></section></section>";
      hostDocument.body.appendChild(shell);
      launcher = shadow.querySelector(".launcher");
      panel = shadow.querySelector(".panel");
      frame = shadow.querySelector(".phone");
      floorSelect = shadow.querySelector(".select");
      modeButton = shadow.querySelector(".mode");
      stateBadge = shadow.querySelector(".badge");
      titleFloor = shadow.querySelector(".floor-title");
      launcher.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        toggleShell(!shellOpen);
      });
      var floorToggle = shadow.querySelector(".floor-toggle");
      var floorDrawer = shadow.querySelector(".floor-drawer");
      floorToggle.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var nextOpen = !floorDrawer.classList.contains("open");
        floorDrawer.classList.toggle("open", nextOpen);
        floorToggle.setAttribute("aria-expanded", nextOpen ? "true" : "false");
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
      applySavedPosition();
      updateChrome();
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
      } else {
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
      shadow.querySelector(".phone-wrap").classList.toggle("history", !writable);
      titleFloor.textContent = selectedId ? "楼层 " + selectedId : "等待楼层";
      var count = phoneApi("__ST_GET_PENDING_OPERATION_VIEW__", [], true);
      var note = phoneApi("__ST_GET_PENDING_OPERATION_NOTE__", [], true);
      var total = (Array.isArray(count) ? count.length : 0) + (String(note || "").trim() ? 1 : 0);
      var launcherBadge = shadow.querySelector(".launcher i");
      if (launcherBadge) launcherBadge.textContent = String(total);
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
      badge.textContent = "历史楼层只读；切回当前楼后才能操作";
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
        return node && node.nodeType === 1 && node.classList && node.classList.contains("st-galgame-card__portrait");
      });
      if (!portrait) {
        try { portrait = event.target && event.target.closest ? event.target.closest(".st-galgame-card__portrait") : null; } catch (_) {}
      }
      var card = portrait && portrait.closest ? portrait.closest(".st-galgame-card[data-galgame-role]") : null;
      var roleName = card && card.dataset.galgameUser !== "true" ? textId(card.dataset.galgameRole) : "";
      var id = mesIdFromElement(event.target);
      if (selectionMode === "follow" && id && floorItems().map(function (item) { return item.id; }).indexOf(id) >= 0) {
        selectFloor(id, "follow");
      }
      if (!roleName) return;
      event.preventDefault();
      event.stopPropagation();
      openProfileRole(roleName);
    };
    hostResizeHandler = function () { if (panel) applySavedPosition(); };
    hostDocument.addEventListener("click", hostClickHandler, true);
    host.addEventListener("resize", hostResizeHandler, { passive: true });

    return {
      revision: config.revision,
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
      subscribeStage: function (fn) { stageSubscribers.add(fn); return function () { stageSubscribers.delete(fn); }; },
      openPhone: function () { toggleShell(true); },
      openProfileRole: openProfileRole,
      updateChrome: updateChrome,
      destroy: function () {
        if (mountTimer) host.clearTimeout(mountTimer);
        mountTimer = 0;
        if (profileOpenTimer) host.clearTimeout(profileOpenTimer);
        profileOpenTimer = 0;
        pendingProfileRole = "";
        try { fetchController?.abort?.(); } catch (_) {}
        fetchController = null;
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
    return "html,body{margin:0;background:transparent!important;color:inherit}body{padding:0!important}.stage{margin:10px 0;border:1px solid rgba(122,95,153,.3);border-radius:20px;background:linear-gradient(145deg,rgba(255,252,246,.98),rgba(245,237,248,.96));box-shadow:0 10px 26px rgba(48,32,57,.12);color:#4b354e;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden}.head{display:flex;align-items:center;gap:9px;padding:12px 14px;border-bottom:1px solid rgba(91,63,98,.12)}.head strong{font-size:14px}.head small{color:#8a718c}.grow{flex:1}.open{border:1px solid rgba(111,63,132,.25);border-radius:11px;background:#fff8;color:#603969;font:800 12px system-ui;padding:7px 10px;cursor:pointer}.status{padding:4px 8px;border-radius:999px;background:#e6f7ef;color:#23715a;font:800 10px system-ui}.status.history{background:#fff2d8;color:#8b5a16}.body{padding:10px 12px 12px}.empty{padding:15px;border:1px dashed rgba(101,73,107,.22);border-radius:13px;text-align:center;color:#9a869c;font-size:12px}.list{display:grid;gap:7px;max-height:225px;overflow:auto}.item{display:grid;grid-template-columns:1fr auto;gap:5px 10px;padding:9px 10px;border:1px solid rgba(103,73,111,.14);border-radius:12px;background:rgba(255,255,255,.62)}.item b{font-size:12px}.item p{grid-column:1/2;margin:0;color:#7f687f;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.item button{grid-row:1/3;grid-column:2;border:0;background:transparent;color:#b05271;font-size:18px;cursor:pointer}.item button:disabled{color:#b9aeb8}.note{width:100%;min-height:62px;margin-top:9px;padding:9px 10px;resize:vertical;border:1px solid rgba(103,73,111,.18);border-radius:12px;background:#fffafc;color:#4d374f;font:12px/1.55 system-ui}.actions{display:flex;align-items:center;gap:7px;margin-top:9px}.actions label{margin-right:auto;color:#806b82;font-size:11px}.actions button{border:1px solid rgba(103,73,111,.2);border-radius:11px;background:#fff9;color:#654669;font:800 11px system-ui;padding:8px 10px;cursor:pointer}.actions .send{background:linear-gradient(135deg,#7d3d8d,#d4518e);color:white;border-color:transparent}.actions button:disabled,.note:disabled{opacity:.45;cursor:not-allowed}.modal{position:fixed;inset:0;z-index:10;display:grid;place-items:center;background:rgba(17,10,20,.54);padding:14px}.modal-card{max-width:360px;border-radius:17px;background:#fffafc;color:#4d374f;padding:17px;box-shadow:0 20px 60px rgba(0,0,0,.28)}.modal-card p{font-size:12px;line-height:1.65}.modal-card div{display:flex;justify-content:flex-end;gap:8px}.modal-card button{border:1px solid #ddcadf;border-radius:10px;background:white;color:#604762;padding:8px 11px;font-weight:800}.modal-card .danger{background:#a83f61;color:white;border-color:transparent}";
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
        return "<article class='item'><b>" + escapeHtml(item.source || "APP") + " · " + escapeHtml(item.action || "操作") + "</b><p>" + escapeHtml(item.summary || "无附加信息") + "</p><button type='button' data-remove='" + escapeHtml(item.id || item.key) + "' " + (item.locked ? "disabled title='锁定操作'" : "title='移除'") + ">" + (item.locked ? "⌕" : "×") + "</button></article>";
      }).join("") + "</div>" : "<div class='empty'>还没有本轮操作。手机中的命令、任务与购买会先暂存在这里。</div>";
      body = list + "<textarea class='note' placeholder='写给 AI 的普通备注，不会替代前端操作。'>" + escapeHtml(note || "") + "</textarea>" +
        "<div class='actions'><label><input class='keep' type='checkbox' " + (keep ? "checked" : "") + "> 确认后保留</label><button type='button' data-clear>清空</button><button class='send' type='button' data-flush>写入输入框</button></div>";
    }
    root.innerHTML = "<section class='stage'><header class='head'><strong>本轮操作暂存区</strong><small>" + views.length + " 项</small><span class='grow'></span><span class='status " + (writable && selectedWritable ? "" : "history") + "'>" + (writable ? (selectedWritable ? "当前楼" : "手机正查看历史") : "历史楼") + "</span><button class='open' type='button'>打开手机</button></header><div class='body'>" + body + "</div></section>";
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
  var registry = ensureRegistry(host);
  if (!registry) return;
  var ownMessageId = messageIdFromWindow() || registry.getWritableId() || "current";

  document.documentElement.dataset.hypnoosStagingOnly = "true";
  var style = document.createElement("style");
  style.textContent = stageCss();
  document.head.appendChild(style);
  var root = document.createElement("div");
  root.id = "hypnoos-operation-placeholder";
  document.body.replaceChildren(root, script);

  registry.register({ token: token, messageId: ownMessageId, view: window, config: config });
  var unsubscribe = registry.subscribeStage(function () { renderStage(registry, root, ownMessageId); });
  renderStage(registry, root, ownMessageId);

  window.addEventListener("pagehide", function () {
    try { unsubscribe(); } catch (_) {}
    registry.unregister(ownMessageId, token);
  }, { once: true });
})();
