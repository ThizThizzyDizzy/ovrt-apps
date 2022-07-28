const API = new OVRT({
    "function_queue": true
});
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const hand = urlParams.get("hand");
API.setCurrentBrowserTitle("VRC Gesture Indicator "+hand);
var timer = setInterval(update, 30);
document.getElementById("indicator").innerHTML = "Loading";//4;//"<img class=\"indicator\" src=\"images/outer/"+out+".png\"\">";
async function update(){
    let curls = await API.getFingerCurls();
    let thumb = 0;
    let index = 0;
    let middle = 0;
    let ring = 0;
    let pinky = 0;
    if(hand==="left"){
        thumb = curls.LThumb;
        index = curls.LIndex;
        middle = curls.LMiddle;
        ring = curls.LRing;
        pinky = curls.LPinky;
    }else{
        thumb = curls.RThumb;
        index = curls.RIndex;
        middle = curls.RMiddle;
        ring = curls.RRing;
        pinky = curls.RPinky;
    }
    let fingies = (middle+ring+pinky)/3;
    let thumbUp = thumb<0.5;
    let thumbDown = thumb>0.5;
    let indexUp = index<0.39;
    let indexDown = index>0.74;
    let middleUp = middle<0.065;
    let middleDown = middle>0.27;
    let ringUp = ring<.115;
    let ringDown = ring>.39;
    let pinkyUpper = pinky<0.125;//open hand
    let pinkyUp = pinky<.110;//rocknroll
    let pinkyDown = pinky>.39;//fist
    let gesture = "idle";
    if(thumbUp===true&&indexUp===true&&middleUp===true&&ringUp===true&&pinkyUpper===true)gesture = "open_hand";
    if(thumbUp===true&&indexUp===true&&middleDown===true&&ringDown===true&&pinkyDown===true)gesture = "finger_gun";
    if(thumbDown===true&&indexDown===true&&middleDown===true&&ringDown===true&&pinkyDown===true)gesture = "fist";
    if(thumbDown===true&&indexUp===true&&middleDown===true&&ringDown===true&&pinkyDown===true)gesture = "point";
    if(indexUp===true&&middleDown===true&&ringDown===true&&pinkyUp===true)gesture = "rock_and_roll";
    if(thumbUp===true&&indexDown===true&&middleDown===true&&ringDown===true&&pinkyDown===true)gesture = "thumbs_up";
    if(thumbDown===true&&indexUp===true&&middleUp===true&&ringDown===true&&pinkyDown===true)gesture = "victory";
    if(gesture==="idle"){
        document.getElementById("indicator").innerHTML = "";
    }else{
        document.getElementById("indicator").innerHTML = "<img class=\"indicator\" src=\"images/"+hand+"/"+gesture+".png\"\">";
    }
}
API.on("message", async function (event){
    let msg = event.message;
    if(msg&&msg.app==="VRCGestureIndicator"){
        if(msg.event==="attach"){
            new OVRTOverlay(await API.getUniqueID()).setAttachedDevice(1);
        }
        if(msg.event==="detach"){
            new OVRTOverlay(await API.getUniqueID()).setAttachedDevice(0);
        }
        if(msg.event==="lock"){
            API.blockMovement(true);
        }
        if(msg.event==="unlock"){
            API.blockMovement(false);
        }
    }
});