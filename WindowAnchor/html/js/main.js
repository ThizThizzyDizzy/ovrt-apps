const API = new OVRT({
    "function_queue": true
});
var currentWindow = null;
status();
var depth = 0;
function status(){
    let total = localStorage.getItem("lastID");
    depth = 0;
    document.getElementById("status").innerHTML = (total?"Total anchors spawned: "+(++total):"");
    document.getElementById("patreon").hidden = !(isprime(total)&&ishappy(total));
}
function ishappy(n){
    if(n===1)return true;
    depth++;
    if(depth>1000)return false;//not gonna bother with that
    let s = n+"";
    let sum = 0;
    for(let i = 0; i < s.length; i++){
        let d = parseInt(s[i]);
        sum+=d*d;
    }
    return ishappy(sum);
}
function isprime(n){
    if(n<2)return false;
    for(let i = 2; i<n; i++){
        if(n%i==0)return false;
    }
    return true;
}
API.on("device-position", function(id, pos){
    if(id===1&&currentWindow!==null){
        currentWindow = null;
        var data = JSON.parse(pos);
        currentWindow.setPosition(data["posX"],data["posY"]-0.1,data["posZ"]);
        currentWindow.setRotation(data["rotX"],data["rotY"],data["rotZ"]);
        currentWindow.translateForward(0.5);
    }
});
function spawnAnchor() {
    API.spawnOverlay({
        posX: 0, 
        posY: 0, 
        posZ: 0, 
        rotX: 0, 
        rotY: 0, 
        rotZ: 0, 
        size: 0.18, 
        opacity: 1, 
        curvature: 0, 
        framerate: 60, 
        ecoMode: true, 
        lookHiding: false, 
        attachedDevice: 0, 
        shouldSave: true
    }).then(overlay => {
        currentWindow = overlay;
        overlay.setBrowserOptionsEnabled(false);
        var id = localStorage.getItem("lastID");
        if(!id)id = -1;
        id++;
        localStorage.setItem("lastID", id);
        var key = "anchor_"+id;
        if(localStorage.getItem(key))localStorage.removeItem(key);//clear previous settings just in case of duplicates
        overlay.setContent(0, {
            url: "anchor.html?id="+id,
            width: 500,
            height: 500
        });
        status();
    }).catch(err => {
        console.error(err);
    });
}
function clearData(){
    var id = localStorage.getItem("lastID");
    if(!id)return;
    for(let i = 0; i<=id; i++){
        localStorage.removeItem("anchor_"+id);
    }
    localStorage.removeItem("lastID");
    status();
}