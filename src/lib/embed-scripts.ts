import "server-only";

import { formLook, type FormFieldDef, type FormSettings } from "@/lib/forms";

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

// Classi .fc-* uguali a quelle dei form del CRM: il CSS personalizzato di un
// form del CRM funziona anche qui, copiato così com'è.
const FORM_STYLES = `
  :host { all: initial; display: block; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  * { box-sizing: border-box; }
  form { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 14px; }
  form > * { flex: 1 1 100%; min-width: 0; }
  .fc-sr { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
  .fc-card { padding: 24px 20px; margin: 0 auto; }
  .fc-title { margin: 0 0 16px; font-weight: 700; }
  .fc-text { margin: 0; font-size: 14px; line-height: 1.5; white-space: pre-line; }
  .fc-text a { color: inherit; }
  .fc-image { display: inline-block; max-width: 100%; height: auto; }
  .fc-field { display: flex; flex-direction: column; }
  label { display: block; margin-bottom: 4px; font-size: 13px; font-weight: 600; }
  input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="date"], select, textarea {
    width: 100%; padding: 11px 12px; font: inherit; font-size: 15px;
  }
  textarea { resize: vertical; }
  input:focus, select:focus, textarea:focus { outline: 2px solid var(--fc-color); outline-offset: -1px; border-color: transparent; }
  .fc-help { margin-top: 3px; font-size: 12px; opacity: 0.8; }
  .fc-radio-group { display: flex; flex-direction: column; gap: 6px; }
  .fc-radio-item, .fc-checkbox-row, .fc-privacy { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; font-weight: 400; }
  .fc-privacy { font-size: 12px; }
  .fc-radio-item input, .fc-checkbox-row input, .fc-privacy input { width: auto; margin-top: 3px; accent-color: var(--fc-color); cursor: pointer; }
  .fc-links { margin: 4px 0 0; font-size: 12px; text-align: center; }
  .fc-links a { color: inherit; }
  .fc-footer { display: block; margin-top: 6px; }
  button.fc-submit { width: 100%; padding: 13px 20px; border: none; background: var(--fc-color); font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; }
  button.fc-submit:hover { filter: brightness(0.93); }
  button.fc-submit:disabled { opacity: 0.6; cursor: not-allowed; }
  .fc-message { padding: 14px; border-radius: 10px; font-size: 14px; }
  .fc-message.success { background: #ecfdf5; color: #065f46; }
  .fc-message.error { background: #fef2f2; color: #991b1b; }
  .fc-launcher { position: fixed; right: 20px; bottom: 20px; z-index: 2147483000; display: flex; align-items: center; justify-content: center; width: 58px; height: 58px; border: none; border-radius: 50%; background: var(--fc-color); color: #fff; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,.2); }
  .fc-launcher svg { width: 26px; height: 26px; }
  .fc-panel { position: fixed; right: 20px; bottom: 90px; z-index: 2147483000; display: flex; flex-direction: column; width: 360px; max-width: calc(100vw - 40px); max-height: min(560px, calc(100vh - 110px)); overflow: hidden; border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,.18); }
  .fc-panel.fc-closed { display: none; }
  .fc-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 16px; background: var(--fc-color); color: #fff; font-size: 15px; font-weight: 600; }
  .fc-close { padding: 0; border: none; background: none; color: #fff; font-size: 22px; line-height: 1; cursor: pointer; }
  .fc-body { display: flex; flex-direction: column; gap: 12px; padding: 16px; overflow-y: auto; }
  .fc-welcome { margin: 0; font-size: 14px; }
`;

/** CSS dell'aspetto scelto nel costruttore più il CSS libero, tutto dentro lo shadow root. */
function buildLookCss(color: string, settings: FormSettings): string {
  const look = formLook(settings);
  const rules = [
    `:host{--fc-color:${color};color:${look.text}}`,
    look.font ? `:host{font-family:'${look.font}',-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}` : "",
    `form{gap:${look.gap}px}`,
    `form>.fc-half{flex:1 1 calc(50% - ${look.gap / 2}px)}`,
    `@media (max-width:480px){form>.fc-half{flex-basis:100%}}`,
    `.fc-card,.fc-panel{background:${settings.formBg}}`,
    `.fc-card{max-width:${look.cardMaxWidth}px;border:${look.cardBorder};border-radius:${look.cardRadius}px;box-shadow:${look.cardShadow}}`,
    look.cardPadding !== undefined ? `.fc-card{padding:${look.cardPadding}px}` : "",
    `.fc-title{color:${look.title};font-size:${look.titleSize}px;text-align:${look.titleAlign}}`,
    `label,.fc-radio-item,.fc-checkbox-row,.fc-welcome{color:${look.label}}`,
    `.fc-privacy,.fc-links,.fc-help{color:${look.muted}}`,
    `input[type="text"],input[type="email"],input[type="tel"],input[type="number"],input[type="date"],select,textarea{border:${look.fieldBorder};border-radius:${look.fieldRadius}px;background:${look.fieldBg};color:${look.fieldText}}`,
    `::placeholder{color:${look.placeholder};opacity:1}`,
    `button.fc-submit{color:${look.buttonText};border-radius:${look.buttonRadius}px}`,
    settings.customCss ?? "",
  ];
  return rules.filter(Boolean).join("\n");
}

/**
 * Script del form: lo disegna in uno shadow root (gli stili del sito ospite non
 * lo toccano e viceversa), nel punto dello script o come bolla in basso a destra.
 * Lo stesso form può stare più volte nella pagina (es. sezione + finestra).
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
  const settings: FormSettings = {
    ...config.settings,
    redirectUrl: sanitizeUrl(config.settings.redirectUrl),
    privacyPolicyUrl: sanitizeUrl(config.settings.privacyPolicyUrl),
    termsUrl: sanitizeUrl(config.settings.termsUrl ?? ""),
  };
  const font = formLook(settings).font;

  return `(function () {
  var FORM_ID = ${safeJson(config.formId)};
  var TITLE = ${safeJson(config.title)};
  var FIELDS = ${safeJson(config.fields)};
  var S = ${safeJson(settings)};
  var MODE = ${safeJson(config.displayMode)};
  var WELCOME = ${safeJson(config.welcomeMessage)};
  var BASE_URL = ${safeJson(config.baseUrl)};
  var STYLE = ${safeJson(FORM_STYLES + buildLookCss(config.color, settings))};
  var FONT = ${safeJson(font)};
  var currentScript = document.currentScript;

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  function safeLink(value) {
    return /^(https?:|mailto:|tel:)/i.test(value || "") ? value : "";
  }

  function findHost() {
    var containerId = "fusion-beauty-form-" + FORM_ID;
    // prima il contenitore subito prima dello script, poi il primo ancora vuoto
    var prev = currentScript && currentScript.previousElementSibling;
    if (prev && prev.id === containerId && !prev.shadowRoot) return prev;
    var hosts = document.querySelectorAll('[id="' + containerId + '"]');
    for (var i = 0; i < hosts.length; i++) if (!hosts[i].shadowRoot) return hosts[i];
    var host = el("div");
    host.id = containerId;
    if (currentScript && currentScript.parentNode && document.body.contains(currentScript)) currentScript.parentNode.insertBefore(host, currentScript);
    else document.body.appendChild(host);
    return host;
  }

  function mount() {
    var host;
    if (MODE === "POPUP") {
      host = el("div");
      document.body.appendChild(host);
    } else {
      host = findHost();
    }
    var root = host.attachShadow({ mode: "open" });
    root.appendChild(el("style", null, STYLE));
    // dentro uno shadow root i font funzionano solo se caricati nella pagina
    if (FONT && !document.querySelector('link[data-fusion-font="' + FONT + '"]')) {
      var fontLink = el("link");
      fontLink.rel = "stylesheet";
      fontLink.href = "https://fonts.googleapis.com/css2?family=" + FONT.replace(/ /g, "+") + ":wght@300;400;500;600;700;900&display=swap";
      fontLink.setAttribute("data-fusion-font", FONT);
      document.head.appendChild(fontLink);
    }
    var shownAt = Date.now();
    // id unici anche con lo stesso form due volte nella pagina
    var uid = "fc-" + FORM_ID + "-" + Math.random().toString(36).slice(2, 7) + "-";

    function field(f) {
      var node = element(f);
      if (f.half) node.classList.add("fc-half");
      return node;
    }

    function element(f) {
      if (f.type === "content") {
        var block = el("div", "fc-text");
        if (f.textSize) block.style.fontSize = f.textSize + "px";
        if (f.textColor) block.style.color = f.textColor;
        if (f.textAlign) block.style.textAlign = f.textAlign;
        if (f.textBold) block.style.fontWeight = "700";
        var href = safeLink(f.linkUrl);
        if (href) {
          var a = el("a", null, f.content || "");
          a.href = href; a.target = "_blank"; a.rel = "noopener";
          block.appendChild(a);
        } else {
          block.textContent = f.content || "";
        }
        return block;
      }
      if (f.type === "image") {
        var imgWrap = el("div");
        imgWrap.style.textAlign = f.imageAlign || "center";
        if (/^https?:/i.test(f.imageUrl || "")) {
          var img = el("img", "fc-image");
          img.src = f.imageUrl; img.alt = f.imageAlt || "";
          img.style.width = (f.imageWidth || 60) + "%";
          imgWrap.appendChild(img);
        }
        return imgWrap;
      }
      var wrap = el("div", "fc-field");
      var id = uid + f.key;
      var star = f.required ? " *" : "";
      function label(forId) {
        var l = el("label", S.hideLabels ? "fc-sr" : null, f.label + star);
        if (forId) l.htmlFor = forId;
        return l;
      }
      if (f.type === "checkbox") {
        var row = el("label", "fc-checkbox-row");
        var cb = el("input");
        cb.type = "checkbox"; cb.name = f.key; cb.required = !!f.required;
        row.appendChild(cb);
        row.appendChild(el("span", null, f.label + star));
        wrap.appendChild(row);
      } else if (f.type === "radio") {
        wrap.appendChild(label(null));
        var group = el("div", "fc-radio-group");
        (f.options || []).forEach(function (opt) {
          var item = el("label", "fc-radio-item");
          var radio = el("input");
          radio.type = "radio"; radio.name = f.key; radio.value = opt; radio.required = !!f.required;
          item.appendChild(radio);
          item.appendChild(el("span", null, opt));
          group.appendChild(item);
        });
        wrap.appendChild(group);
      } else {
        wrap.appendChild(label(id));
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
        else if (S.hideLabels && f.type !== "select") input.placeholder = f.label + star;
        wrap.appendChild(input);
      }
      if (f.helpText) wrap.appendChild(el("span", "fc-help", f.helpText));
      return wrap;
    }

    var form = el("form");
    var honeypot = el("input");
    honeypot.type = "text"; honeypot.name = "website"; honeypot.tabIndex = -1; honeypot.autocomplete = "off";
    honeypot.setAttribute("aria-hidden", "true");
    honeypot.style.cssText = "position:absolute;left:-10000px;opacity:0;height:0;width:0";
    form.appendChild(honeypot);
    FIELDS.forEach(function (f) { form.appendChild(field(f)); });

    var privacy = null;
    if (S.requirePrivacyConsent) {
      var row = el("label", "fc-privacy");
      privacy = el("input");
      privacy.type = "checkbox"; privacy.required = true;
      row.appendChild(privacy);
      row.appendChild(el("span", null, S.privacyText));
      form.appendChild(row);
    }

    var submit = el("button", "fc-submit", S.submitButtonText);
    submit.type = "submit";
    form.appendChild(submit);
    var message = el("div");
    message.style.display = "none";

    function links() {
      if (!S.privacyPolicyUrl && !S.termsUrl && !S.footerText) return null;
      var p = el("p", "fc-links");
      function add(href, text) {
        if (p.childNodes.length) p.appendChild(document.createTextNode(" | "));
        var a = el("a", null, text);
        a.href = href; a.target = "_blank"; a.rel = "noopener";
        p.appendChild(a);
      }
      if (S.privacyPolicyUrl) add(S.privacyPolicyUrl, S.privacyLinkText || "Informativa privacy");
      if (S.termsUrl) add(S.termsUrl, S.termsLinkText || "Termini e condizioni");
      if (S.footerText) p.appendChild(el("span", "fc-footer", S.footerText));
      return p;
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      submit.disabled = true;
      var values = {};
      FIELDS.forEach(function (f) {
        if (f.type === "content" || f.type === "image") return;
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
          message.className = "fc-message success";
          message.textContent = S.successMessage;
          message.style.display = "block";
          try { window.dispatchEvent(new CustomEvent("fusion-beauty:form-submitted", { detail: { formId: FORM_ID } })); } catch (e) {}
          if (S.redirectUrl) window.location.href = S.redirectUrl;
        })
        .catch(function (err) {
          submit.disabled = false;
          message.className = "fc-message error";
          message.textContent = err && err.message && err.message !== "Failed to fetch" ? err.message : "Si è verificato un errore. Riprova.";
          message.style.display = "block";
        });
    });

    var footer = links();
    if (MODE === "POPUP") {
      var launcher = el("button", "fc-launcher");
      launcher.type = "button";
      launcher.setAttribute("aria-label", TITLE || "Scrivici");
      launcher.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
      var panel = el("div", "fc-panel fc-closed");
      var header = el("div", "fc-header");
      header.appendChild(el("span", null, TITLE || "Scrivici"));
      var close = el("button", "fc-close", "\\u00d7");
      close.type = "button";
      close.setAttribute("aria-label", "Chiudi");
      header.appendChild(close);
      var body = el("div", "fc-body");
      if (WELCOME) body.appendChild(el("p", "fc-welcome", WELCOME));
      body.appendChild(form);
      body.appendChild(message);
      if (footer) body.appendChild(footer);
      panel.appendChild(header);
      panel.appendChild(body);
      function setOpen(open) {
        panel.classList.toggle("fc-closed", !open);
        launcher.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) shownAt = Date.now();
      }
      launcher.addEventListener("click", function () { setOpen(panel.classList.contains("fc-closed")); });
      close.addEventListener("click", function () { setOpen(false); });
      root.appendChild(panel);
      root.appendChild(launcher);
    } else {
      var card = el("div", "fc-card");
      if (TITLE) card.appendChild(el("h3", "fc-title", TITLE));
      card.appendChild(form);
      card.appendChild(message);
      if (footer) card.appendChild(footer);
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
  mode: "inline" | "button" | "popup" | "link";
  text: string;
  color: string;
  /** Agenda personalizzata: solo questi trattamenti, colore dentro l'agenda, senza intestazione. */
  services: string[];
  /** Parole nel nome dei trattamenti (es. "laser,ascelle"). */
  search?: string;
  tint: boolean;
  header: boolean;
}): string {
  const query = new URLSearchParams({ embed: "1" });
  if (p.services.length) query.set("servizi", p.services.join(","));
  if (p.search) query.set("cerca", p.search);
  if (p.tint) query.set("colore", p.color);
  if (!p.header) query.set("intestazione", "0");
  const cfg = { base: p.baseUrl, slug: p.slug, title: p.title, mode: p.mode, text: p.text, color: p.color, query: query.toString() };
  return `(function(){
var C=${safeJson(cfg)};
var me=document.currentScript;
var src=C.base+"/embed/"+encodeURIComponent(C.slug)+"?"+C.query;
var pre=me&&me.dataset?["nome","cognome","telefono","email"].map(function(k){var v=me.getAttribute("data-"+k);return v?"&"+k+"="+encodeURIComponent(v):"";}).join(""):"";src+=pre;
if(!window.__fusionBeautyBooking){window.__fusionBeautyBooking=[];
window.addEventListener("message",function(e){var d=e.data||{};var list=window.__fusionBeautyBooking;for(var i=0;i<list.length;i++){if(list[i].contentWindow!==e.source)continue;
if(d.type==="fusion-beauty:height"&&typeof d.height==="number")list[i].style.height=Math.max(480,Math.ceil(d.height)+8)+"px";
if(d.type==="fusion-beauty:booked"){try{window.dispatchEvent(new CustomEvent("fusion-beauty:booked",{detail:{service:d.service,startTime:d.startTime}}));}catch(x){}}}});}
function frame(){var f=document.createElement("iframe");f.src=src;f.title=C.title;f.style.cssText="display:block;width:100%;border:0;min-height:480px;height:640px;background:transparent";window.__fusionBeautyBooking.push(f);return f;}
// In modalità "link" lo script non occupa contenitori: restano per le agende in pagina.
var target=null;
if(C.mode!=="link"){target=me&&me.previousElementSibling;
if(!target||target.id!=="fusion-beauty-booking-"+C.slug||target.getAttribute("data-ready")){target=null;var all=document.querySelectorAll('[id="fusion-beauty-booking-'+C.slug+'"]');for(var j=0;j<all.length;j++)if(!all[j].getAttribute("data-ready")){target=all[j];break;}}
if(!target){target=document.createElement("div");if(me&&me.parentNode)me.parentNode.insertBefore(target,me);else document.body.appendChild(target);}
target.setAttribute("data-ready","1");}
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
// I pulsanti del sito aprono l'agenda: data-fusion-beauty-booking (o window.FusionBeautyBooking.open())
window.FusionBeautyBooking=window.FusionBeautyBooking||{open:function(){}};if(!window.FusionBeautyBooking.bySlug)window.FusionBeautyBooking.bySlug={};
if(!window.FusionBeautyBooking.bySlug[C.slug]){window.FusionBeautyBooking.bySlug[C.slug]=open;window.FusionBeautyBooking.open=open;
document.addEventListener("click",function(e){var t=e.target&&e.target.closest&&e.target.closest("[data-fusion-beauty-booking]");if(!t)return;var s=t.getAttribute("data-fusion-beauty-booking");if(s&&s!==C.slug)return;e.preventDefault();open();});}
if(C.mode==="link")return;
if(C.mode==="popup")document.body.appendChild(button(true));
else if(C.mode==="button")target.appendChild(button(false));
else target.appendChild(frame());
})();`;
}
