/* Date Lotto Generator: original Adsterra publisher GET CODE.
 * One banner per page load on the approved host, after valid shared consent.
 * No ad request without advertising opt-in; no background refresh or retries.
 * Parser-time document.write follows the existing Apps & Games web pilots,
 * but that technique is not separately endorsed by the provider.
 */
(() => {
  "use strict";
  if (location.hostname !== "lotto.appsandgames.org") return;
  if (document.readyState !== "loading") return;
  if (navigator.onLine === false) return;

  const script = document.currentScript;
  const unit = script?.dataset.unit;
  const slot = script?.parentElement;
  const area = slot?.parentElement;
  if (!slot?.classList.contains("lotto-ad-unit") ||
      area?.id !== "lotto-ad-area") return;
  const widthDesktop = matchMedia("(min-width: 800px)").matches;
  const widthMobile = matchMedia("(min-width: 320px) and (max-width: 799px)").matches;
  if (!(unit === "desktop" && widthDesktop ||
        unit === "mobile" && widthMobile)) return;

  let allowed = false;
  try {
    const choice = document.cookie.split(";").map(s => s.trim())
      .find(s => s.startsWith("ag_privacy_choices_v1="));
    const record = choice && JSON.parse(decodeURIComponent(
      choice.slice("ag_privacy_choices_v1=".length)));
    const elapsed = record && Date.now() - record.timestamp;
    allowed = !!record && record.version === 1 &&
      record.partnerRevision === "adsterra-2026-11" &&
      record.advertising === true && Number.isFinite(elapsed) &&
      elapsed >= 0 && elapsed <= 180 * 24 * 60 * 60 * 1000;
  } catch (_) { allowed = false; }
  if (!allowed) return;

  const tags = {
    desktop: "<script>\n  atOptions = {\n    'key' : '46622650937900d024f9c01d9ff268e7',\n    'format' : 'iframe',\n    'height' : 90,\n    'width' : 728,\n    'params' : {}\n  };\n</script>\n<script src=\"https://bauval.org/22/46622650937900d024f9c01d9ff268e7\"></script>",
    mobile: "<script>\n  atOptions = {\n    'key' : 'b0361a0b5c8a50d91b07c765bf388248',\n    'format' : 'iframe',\n    'height' : 50,\n    'width' : 320,\n    'params' : {}\n  };\n</script>\n<script src=\"https://bauval.org/22/b0361a0b5c8a50d91b07c765bf388248\"></script>"
  };
  area.hidden = false;
  slot.hidden = false;
  const label = document.createElement("span");
  label.className = "lotto-ad-label";
  label.textContent = "Advertisement";
  slot.insertBefore(label, script);
  document.write(tags[unit]);
})();
