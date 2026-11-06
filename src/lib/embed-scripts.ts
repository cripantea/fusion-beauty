import "server-only";

import type { FormFieldDef, FormSettings } from "@/lib/forms";

/** Impedisce a un `</script>` dentro il JSON di chiudere lo script generato. */
function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function sanitizeUrl(value: string): string {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol) ? value : "";
  } catch {
    return "";
  }
}

const FORM_STYLES = `
  :host { all: initial; display: block; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  * { box-sizing: border-box; }
  form { display: flex; flex-wrap: wrap; gap: 14px; }
  form > * { flex: 1 1 100%; min-width: 0; }
  form > .fb-half { flex: 1 1 calc(50% - 7px); }
  @media (max-width: 480px) { form > .fb-half { flex-basis: 100%; } }
  .fb-card { padding: 24px 20px; border-radius: 16px; max-width: 520px; margin: 0 auto; }
  .fb-title { margin: 0 0 16px; font-size: 20px; font-weight: 700; text-align: center; }
  .fb-text { margin: 0; font-size: 14px; line-height: 1.5; white-space: pre-line; }
  label { display: block; margin-bottom: 4px; font-size: 13px; font-weight: 600; }
  input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="date"], select, textarea {
    width: 100%; padding: 11px 12px; border: 1px solid #d1d5db; background: #fff; color: #111827; font: inherit; font-size: 15px;
  }
  textarea { resize: vertical; }
  input:focus, select:focus, textarea:focus { outline: 2px solid var(--fb-color); outline-offset: -1px; border-color: transparent; }
  .fb-choices { display: flex; flex-direction: column; gap: 6px; }
  .fb-choice, .fb-privacy { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; font-weight: 400; }
  .fb-privacy { font-size: 12px; opacity: 0.8; }
  .fb-choice input, .fb-privacy input { margin-top: 3px; accent-color: var(--fb-color); }
  .fb-privacy a { color: inherit; }
  button.fb-submit { width: 100%; padding: 13px 20px; border: none; background: var(--fb-color); color: #fff; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; }
  button.fb-submit:hover { filter: brightness(0.93); }
  button.fb-submit:disabled { opacity: 0.6; cursor: not-allowed; }
  .fb-message { padding: 14px; border-radius: 10px; font-size: 14px; }
  .fb-message.ok { background: #ecfdf5; color: #065f46; }
  .fb-message.err { background: #fef2f2; color: #991b1b; }
  .fb-launcher { position: fixed; right: 20px; bottom: 20px; z-index: 2147483000; display: flex; align-items: center; justify-content: center; width: 58px; height: 58px; border: none; border-radius: 50%; background: var(--fb-color); color: #fff; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,.2); }
  .fb-launcher svg { width: 26px; height: 26px; }
  .fb-panel { position: fixed; right: 20px; bottom: 90px; z-index: 2147483000; display: flex; flex-direction: column; width: 360px; max-width: calc(100vw - 40px); max-height: min(560px, calc(100vh - 110px)); overflow: hidden; border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,.18); }
  .fb-panel.fb-closed { display: none; }
  .fb-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 16px; background: var(--fb-color); color: #fff; font-size: 15px; font-weight: 600; }
  .fb-close { padding: 0; border: none; background: none; color: #fff; font-size: 22px; line-height: 1; cursor: pointer; }
  .fb-body { display: flex; flex-direction: column; gap: 12px; padding: 16px; overflow-y: auto; }
`;

/**
 * Script del form: lo disegna in uno shadow root (gli stili del sito ospite non
 * lo toccano e viceversa), nel punto dello script o come bolla in basso a destra.
 */
export function buildFormEmbedScript(config: {
  formId: string;
  title: string;
  fields: FormFieldDef[];
  settings: FormSettings;
  displayMode: "INLINE" | "POPUP";
  color: string;
  welcomeMessage: string;
  baseUrl: string;
}): string {
  const settings = {
    ...config.settings,
    redirectUrl: sanitizeUrl(config.settings.redirectUrl),
    privacyPolicyUrl: sanitizeUrl(config.settings.privacyPolicyUrl),
  };
  const look = `:host{--fb-color:${config.color};color:${settings.textColor}}
.fb-card,.fb-panel{background:${settings.formBg}}
input[type="text"],input[type="email"],input[type="tel"],input[type="number"],input[type="date"],select,textarea,button.fb-submit{border-radius:${settings.radius}px}`;

  return `(function () {
  var FORM_ID = ${safeJson(config.formId)};
  var TITLE = ${safeJson(config.title)};
  var FIELDS = ${safeJson(config.fields)};
  var S = ${safeJson(settings)};
  var MODE = ${safeJson(config.displayMode)};
  var WELCOME = ${safeJson(config.welcomeMessage)};
  var BASE_URL = ${safeJson(config.baseUrl)};
  var STYLE = ${safeJson(FORM_STYLES + look)};
  var currentScript = document.currentScript;

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  function mount() {
    var host;
    if (MODE === "POPUP") {
      host = el("div");
      document.body.appendChild(host);
    } else {
      host = document.getElementById("fusion-beauty-form-" + FORM_ID);
      if (!host || host.shadowRoot) {
        host = el("div");
        if (currentScript && currentScript.parentNode) currentScript.parentNode.insertBefore(host, currentScript);
        else document.body.appendChild(host);
      }
    }
    var root = host.attachShadow({ mode: "open" });
    root.appendChild(el("style", null, STYLE));
    var shownAt = Date.now();

    function field(f) {
      if (f.type === "content") return el("p", "fb-text", f.content || "");
      var wrap = el("div");
      if (f.half) wrap.className = "fb-half";
      var id = "fb-" + FORM_ID + "-" + f.key;
      var star = f.required ? " *" : "";
      if (f.type === "checkbox") {
        var row = el("label", "fb-choice");
        var cb = el("input");
        cb.type = "checkbox"; cb.name = f.key; cb.required = !!f.required;
        row.appendChild(cb);
        row.appendChild(el("span", null, f.label + star));
        wrap.appendChild(row);
        return wrap;
      }
      var label = el("label", null, f.label + star);
      label.htmlFor = id;
      wrap.appendChild(label);
      if (f.type === "radio") {
        var group = el("div", "fb-choices");
        (f.options || []).forEach(function (opt) {
          var item = el("label", "fb-choice");
          var radio = el("input");
          radio.type = "radio"; radio.name = f.key; radio.value = opt; radio.required = !!f.required;
          item.appendChild(radio);
          item.appendChild(el("span", null, opt));
          group.appendChild(item);
        });
        wrap.appendChild(group);
        return wrap;
      }
      var input;
      if (f.type === "select") {
        input = el("select");
        var first = el("option", null, f.placeholder || "Seleziona…");
        first.value = ""; first.disabled = true; first.selected = true;
        input.appendChild(first);
        (f.options || []).forEach(function (opt) {
          var o = el("option", null, opt);
          o.value = opt;
          input.appendChild(o);
        });
      } else if (f.type === "textarea") {
        input = el("textarea");
        input.rows = 3;
      } else {
        input = el("input");
        input.type = f.type;
        if (f.type === "tel") input.autocomplete = "tel";
        if (f.type === "email") input.autocomplete = "email";
      }
      input.id = id; input.name = f.key; input.required = !!f.required;
      if (f.placeholder && f.type !== "select") input.placeholder = f.placeholder;
      wrap.appendChild(input);
      return wrap;
    }

    var form = el("form");
    form.noValidate = false;
    var honeypot = el("input");
    honeypot.type = "text"; honeypot.name = "website"; honeypot.tabIndex = -1; honeypot.autocomplete = "off";
    honeypot.setAttribute("aria-hidden", "true");
    honeypot.style.cssText = "position:absolute;left:-10000px;opacity:0;height:0;width:0";
    form.appendChild(honeypot);
    FIELDS.forEach(function (f) { form.appendChild(field(f)); });

    var privacy = null;
    if (S.requirePrivacyConsent) {
      var row = el("label", "fb-privacy");
      privacy = el("input");
      privacy.type = "checkbox"; privacy.required = true;
      row.appendChild(privacy);
      var text = el("span", null, S.privacyText + " ");
      if (S.privacyPolicyUrl) {
        var link = el("a", null, "Informativa privacy");
        link.href = S.privacyPolicyUrl; link.target = "_blank"; link.rel = "noopener";
        text.appendChild(link);
      }
      row.appendChild(text);
      form.appendChild(row);
    }

    var submit = el("button", "fb-submit", S.submitButtonText);
    submit.type = "submit";
    form.appendChild(submit);
    var message = el("div");
    message.style.display = "none";

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      submit.disabled = true;
      var values = {};
      FIELDS.forEach(function (f) {
        if (f.type === "content") return;
        if (f.type === "checkbox") {
          values[f.key] = form.elements[f.key] && form.elements[f.key].checked ? "Sì" : "";
        } else if (f.type === "radio") {
          var checked = form.querySelector('input[name="' + f.key + '"]:checked');
          values[f.key] = checked ? checked.value : "";
        } else {
          values[f.key] = form.elements[f.key] ? form.elements[f.key].value : "";
        }
      });
      fetch(BASE_URL + "/api/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId: FORM_ID,
          values: values,
          website: honeypot.value,
          privacyConsent: privacy ? privacy.checked : undefined,
          elapsedMs: Date.now() - shownAt,
          page: window.location.href,
        }),
      })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          if (!result.ok) throw new Error((result.data && result.data.error) || "Invio non riuscito");
          form.style.display = "none";
          message.className = "fb-message ok";
          message.textContent = S.successMessage;
          message.style.display = "block";
          if (S.redirectUrl) window.location.href = S.redirectUrl;
        })
        .catch(function (err) {
          submit.disabled = false;
          message.className = "fb-message err";
          message.textContent = err && err.message && err.message !== "Failed to fetch" ? err.message : "Si è verificato un errore. Riprova.";
          message.style.display = "block";
        });
    });

    if (MODE === "POPUP") {
      var launcher = el("button", "fb-launcher");
      launcher.type = "button";
      launcher.setAttribute("aria-label", TITLE || "Scrivici");
      launcher.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
      var panel = el("div", "fb-panel fb-closed");
      var header = el("div", "fb-header");
      header.appendChild(el("span", null, TITLE || "Scrivici"));
      var close = el("button", "fb-close", "\\u00d7");
      close.type = "button";
      close.setAttribute("aria-label", "Chiudi");
      header.appendChild(close);
      var body = el("div", "fb-body");
      if (WELCOME) body.appendChild(el("p", "fb-text", WELCOME));
      body.appendChild(form);
      body.appendChild(message);
      panel.appendChild(header);
      panel.appendChild(body);
      function setOpen(open) {
        panel.classList.toggle("fb-closed", !open);
        launcher.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) shownAt = Date.now();
      }
      launcher.addEventListener("click", function () { setOpen(panel.classList.contains("fb-closed")); });
      close.addEventListener("click", function () { setOpen(false); });
      root.appendChild(panel);
      root.appendChild(launcher);
    } else {
      var card = el("div", "fb-card");
      if (TITLE) card.appendChild(el("h3", "fb-title", TITLE));
      card.appendChild(form);
      card.appendChild(message);
      root.appendChild(card);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();`;
}

/**
 * Script dell'agenda: mette la pagina /embed/<slug> in un iframe che si allunga da
 * solo (la pagina comunica l'altezza con postMessage), dentro la pagina oppure in
 * una finestra che si apre da un bottone (in linea o flottante).
 */
export function buildBookingEmbedScript(p: {
  slug: string;
  title: string;
  baseUrl: string;
  mode: "inline" | "button" | "popup";
  text: string;
  color: string;
}): string {
  const cfg = { base: p.baseUrl, slug: p.slug, title: p.title, mode: p.mode, text: p.text, color: p.color };
  return `(function(){
var C=${safeJson(cfg)};
var me=document.currentScript;
var src=C.base+"/embed/"+encodeURIComponent(C.slug)+"?embed=1";
if(!window.__fusionBeautyBooking){window.__fusionBeautyBooking=[];
window.addEventListener("message",function(e){var d=e.data||{};var list=window.__fusionBeautyBooking;for(var i=0;i<list.length;i++){if(list[i].contentWindow!==e.source)continue;
if(d.type==="fusion-beauty:height"&&typeof d.height==="number")list[i].style.height=Math.max(480,Math.ceil(d.height)+8)+"px";}});}
function frame(){var f=document.createElement("iframe");f.src=src;f.title=C.title;f.style.cssText="display:block;width:100%;border:0;min-height:480px;height:640px;background:transparent";window.__fusionBeautyBooking.push(f);return f;}
var target=document.getElementById("fusion-beauty-booking-"+C.slug);
if(!target||target.getAttribute("data-ready")){target=document.createElement("div");if(me&&me.parentNode)me.parentNode.insertBefore(target,me);else document.body.appendChild(target);}
target.setAttribute("data-ready","1");
var overlay=null;
function close(){if(overlay&&overlay.parentNode)overlay.parentNode.removeChild(overlay);document.documentElement.style.overflow="";}
function open(){if(!overlay){overlay=document.createElement("div");overlay.style.cssText="position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,15,20,.55)";
var panel=document.createElement("div");panel.style.cssText="position:relative;width:100%;max-width:480px;max-height:92vh;overflow:auto;border-radius:18px;background:#fff";
var x=document.createElement("button");x.type="button";x.setAttribute("aria-label","Chiudi");x.textContent="\\u00d7";x.style.cssText="position:sticky;top:8px;float:right;margin:8px 8px -42px 0;z-index:1;width:34px;height:34px;border:0;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;font:22px/1 system-ui;cursor:pointer";
x.onclick=close;panel.appendChild(x);panel.appendChild(frame());overlay.appendChild(panel);
overlay.addEventListener("click",function(e){if(e.target===overlay)close();});document.addEventListener("keydown",function(e){if(e.key==="Escape")close();});}
document.body.appendChild(overlay);document.documentElement.style.overflow="hidden";}
function button(fixed){var b=document.createElement("button");b.type="button";b.textContent=C.text;
b.style.cssText="cursor:pointer;border:0;border-radius:999px;padding:14px 24px;background:"+C.color+";color:#fff;font:600 15px/1.2 system-ui,-apple-system,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.18)"+(fixed?";position:fixed;right:20px;bottom:20px;z-index:2147483000":"");
b.onclick=open;return b;}
if(C.mode==="popup")document.body.appendChild(button(true));
else if(C.mode==="button")target.appendChild(button(false));
else target.appendChild(frame());
})();`;
}
