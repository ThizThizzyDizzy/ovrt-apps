const API = new OVRT({
    "function_queue": true
});
API.setCurrentBrowserTitle("Beacon");
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const red = urlParams.get("red");
const green = urlParams.get("green");
const blue = urlParams.get("blue");
API.blockMovement(true);
var overlay;
API.getUniqueID().then((id) => {
    overlay = new OVRTOverlay(id);
    overlay.getTransform().then((tf)=>{
        overlay.setPosition(0, tf.size*10, 0);
    });
});
let pos = {
    posX: 0,
    posY: 0,
    posZ: 0
};
API.on("device-position", function(event){
    if(event.deviceId===1)pos = event.deviceInfo;
});
setInterval(function(){
    let dist = Math.sqrt(pos.posX*pos.posX+pos.posZ*pos.posZ);
    let angle = Math.atan2(pos.posX, pos.posZ)*180/Math.PI;
    overlay.setRotation(0, angle+180, 0);
    overlay.setOpacity(Math.max(0, Math.min(0.5, dist/3-0.25)));
    setWidth(Math.max(0, Math.min(1, dist/6)));
}, 1000);
function setWidth(percent){
    percent*=100;
    document.getElementById("beacon").style.left = (50-percent/2)+"%";
    document.getElementById("beacon").style.width = percent+"%";
}
document.getElementById("beacon").style.backgroundColor = "rgb("+red+","+green+","+blue+")";