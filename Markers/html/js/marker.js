const API = new OVRT({
    "function_queue": true
});
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const cen = urlParams.get("center");
const inn = urlParams.get("inner");
const out = urlParams.get("outer");
const cenHue = urlParams.get("cenHue");
const cenSat = urlParams.get("cenSat");
const cenVal = urlParams.get("cenVal");
const innHue = urlParams.get("innHue");
const innSat = urlParams.get("innSat");
const innVal = urlParams.get("innVal");
const outHue = urlParams.get("outHue");
const outSat = urlParams.get("outSat");
const outVal = urlParams.get("outVal");
const locked = urlParams.get("locked");
API.setCurrentBrowserTitle((locked?"Floor ":"")+"Marker");
if(locked){//floor marker
    API.blockMovement(true);
    API.getUniqueID().then((id) => {
        let overlay = new OVRTOverlay(id);
        overlay.setPosition(0, 0, 0);
        overlay.setRotation(90, 0, 0);
    });
}
document.getElementById("marker").innerHTML =
        "<img class=\"outer\" src=\"images/outer/"+out+".png\" style=\"filter: hue-rotate("+outHue+"deg) saturate("+outSat+"%) brightness("+outVal+"%);\">"+
        "<img class=\"inner\" src=\"images/inner/"+inn+".png\" style=\"filter: hue-rotate("+innHue+"deg) saturate("+innSat+"%) brightness("+innVal+"%);\">"+
        "<img class=\"center\" src=\"images/center/"+cen+".png\" style=\"filter: hue-rotate("+cenHue+"deg) saturate("+cenSat+"%) brightness("+cenVal+"%);\">";