const API = new OVRT({
    "function_queue": true
});
var cen = "dot";
var inn = "crosshair_minor";
var out = "square_corners_thick";
var cenHue = 0;
var cenSat = 100;
var cenVal = 100;
var innHue = 0;
var innSat = 100;
var innVal = 100;
var outHue = 0;
var outSat = 100;
var outVal = 100;
var bRed = 0;
var bGrn = 255;
var bBlu = 255;
function center(path){
    cen = path;
    refresh();
}
function inner(path){
    inn = path;
    refresh();
}
function outer(path){
    out = path;
    refresh();
}
function refresh(){
    document.getElementById("preview").innerHTML =
            "<img class=\"preview-outer\" src=\"images/outer/"+out+".png\" style=\"filter: hue-rotate("+outHue+"deg) saturate("+outSat+"%) brightness("+outVal+"%);\">"+
            "<img class=\"preview-inner\" src=\"images/inner/"+inn+".png\" style=\"filter: hue-rotate("+innHue+"deg) saturate("+innSat+"%) brightness("+innVal+"%);\">"+
            "<img class=\"preview-center\" src=\"images/center/"+cen+".png\" style=\"filter: hue-rotate("+cenHue+"deg) saturate("+cenSat+"%) brightness("+cenVal+"%);\">";
    let elems = document.querySelectorAll(".tint-center");
    for(let i = 0; i<elems.length; i++){
        elems[i].style.filter = "hue-rotate("+cenHue+"deg) saturate("+cenSat+"%) brightness("+cenVal+"%)";
    }
    elems = document.querySelectorAll(".tint-outer");
    for(let i = 0; i<elems.length; i++){
        elems[i].style.filter = "hue-rotate("+outHue+"deg) saturate("+outSat+"%) brightness("+outVal+"%)";
    }
    elems = document.querySelectorAll(".tint-inner");
    for(let i = 0; i<elems.length; i++){
        elems[i].style.filter = "hue-rotate("+innHue+"deg) saturate("+innSat+"%) brightness("+innVal+"%)";
    }
}
var currentWindow = null;
API.on("device-position", function(id, pos){
    if(id===1&&currentWindow!==null){
        currentWindow = null;
        var data = JSON.parse(pos);
        currentWindow.setPosition(data["posX"],data["posY"]-0.1,data["posZ"]);
        currentWindow.setRotation(data["rotX"],data["rotY"],data["rotZ"]);
        currentWindow.translateForward(0.5);
    }
});
function spawnMarker() {
    API.spawnOverlay({
        posX: 0, 
        posY: 0, 
        posZ: 0, 
        rotX: 0, 
        rotY: 0, 
        rotZ: 0, 
        size: 0.1, 
        opacity: 1, 
        curvature: 0, 
        framerate: 30, 
        ecoMode: true, 
        lookHiding: false, 
        attachedDevice: 0, 
        shouldSave: true
    }).then(overlay => {
        currentWindow = overlay;
        overlay.setBrowserOptionsEnabled(false);
        overlay.setContent(0, {
            url: "marker.html?center="+cen+"&inner="+inn+"&outer="+out+"&cenHue="+cenHue+"&cenSat="+cenSat+"&cenVal="+cenVal+"&innHue="+innHue+"&innSat="+innSat+"&innVal="+innVal+"&outHue="+outHue+"&outSat="+outSat+"&outVal="+outVal,
            width: 128,
            height: 128
        });
    }).catch(err => {
        console.error(err);
    });
}
function switchMenu(menu){
    if(menu==="center"&&!document.getElementById("center").hidden){
        cen = "none";
        refresh();
    }
    if(menu==="outer"&&!document.getElementById("outer").hidden){
        out = "none";
        refresh();
    }
    if(menu==="inner"&&!document.getElementById("inner").hidden){
        inn = "none";
        refresh();
    }
    document.getElementById("btn-inner").innerHTML = menu==="inner"?"Clear":"Inner";
    document.getElementById("btn-outer").innerHTML = menu==="outer"?"Clear":"Outer";
    document.getElementById("btn-center").innerHTML = menu==="center"?"Clear":"Center";
    document.getElementById("inner").hidden = true;
    document.getElementById("outer").hidden = true;
    document.getElementById("center").hidden = true;
    document.getElementById("settings").hidden = true;
    document.getElementById(menu).hidden = false;
}
function centerHue(val){
    cenHue = val;
    refresh();
}
function centerSat(val){
    cenSat = val;
    refresh();
}
function centerVal(val){
    cenVal = val;
    refresh();
}
function innerHue(val){
    innHue = val;
    refresh();
}
function innerSat(val){
    innSat = val;
    refresh();
}
function innerVal(val){
    innVal = val;
    refresh();
}
function outerHue(val){
    outHue = val;
    refresh();
}
function outerSat(val){
    outSat = val;
    refresh();
}
function outerVal(val){
    outVal = val;
    refresh();
}
function beaconRed(val){
    bRed = val;
}
function beaconGreen(val){
    bGrn = val;
}
function beaconBlue(val){
    bBlu = val;
}
function spawnBeacon(){
    API.spawnOverlay({
        posX: 0, 
        posY: 2.5, 
        posZ: 0, 
        rotX: 0, 
        rotY: 0, 
        rotZ: 0, 
        size: 0.25, 
        opacity: 1, 
        curvature: 0, 
        framerate: 60, 
        ecoMode: false, 
        lookHiding: false, 
        attachedDevice: 0, 
        shouldSave: true
    }).then(overlay => {
        overlay.setBrowserOptionsEnabled(false);
        overlay.setInputBlocked(true);
        overlay.setContent(0, {
            url: "beacon.html?red="+bRed+"&green="+bGrn+"&blue="+bBlu,
            width: 60,
            height: 1200
        });
    }).catch(err => {
        console.error(err);
    });
}
function spawnFloor(){
    API.spawnOverlay({
        posX: 0, 
        posY: 0, 
        posZ: 0, 
        rotX: 90, 
        rotY: 0, 
        rotZ: 0, 
        size: 0.5, 
        opacity: 1, 
        curvature: 0, 
        framerate: 30, 
        ecoMode: true, 
        lookHiding: false, 
        attachedDevice: 0, 
        shouldSave: true
    }).then(overlay => {
        overlay.setBrowserOptionsEnabled(false);
        overlay.setInputBlocked(true);
        overlay.setContent(0, {
            url: "marker.html?center="+cen+"&inner="+inn+"&outer="+out+"&cenHue="+cenHue+"&cenSat="+cenSat+"&cenVal="+cenVal+"&innHue="+innHue+"&innSat="+innSat+"&innVal="+innVal+"&outHue="+outHue+"&outSat="+outSat+"&outVal="+outVal+"&locked=true",
            width: 128,
            height: 128
        });
    }).catch(err => {
        console.error(err);
    });
}