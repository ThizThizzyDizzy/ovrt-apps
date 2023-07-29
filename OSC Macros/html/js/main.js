const API = new OVRT({
    "function_queue": true
});
var currentWindow = null;
statsus();
var depth = 0;
var width = 4;
var height = 1;
var editing = false;
function statsus(){
    let total = localStorage.getItem("lastID");
    depth = 0;
    document.getElementById("patreon").hidden = !(isprime(total)&&ishappy(total));
}
document.getElementById("width").innerHTML = width;
document.getElementById("height").innerHTML = height;
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
function incWidth(){
    width++;
    refreshDimensions();
}
function decWidth(){
    if(width>1)width--;
    refreshDimensions();
}
function incHeight(){
    height++;
    refreshDimensions();
}
function decHeight(){
    if(height>1)height--;
    refreshDimensions();
}
function refreshDimensions(){
    document.getElementById("width").innerHTML = width;
    document.getElementById("height").innerHTML = height;
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
function spawnMacros() {
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
        var id = localStorage.getItem("oscmLastID");
        if(!id)id = -1;
        id++;
        localStorage.setItem("oscmLastID", id);
        var key = "osc_macros_"+id;
        if(localStorage.getItem(key))localStorage.removeItem(key);//clear previous settings just in case of duplicates
        overlay.setContent(0, {
            url: "macros_new.html?id="+id+"&width="+width+"&height="+height,
            width: width*200,
            height: height*200
        });
        statsus();
    }).catch(err => {
        console.error(err);
    });
    editing = false;
    editMacros();
}
function clearData(){
    var id = localStorage.getItem("oscmLastID");
    if(!id)return;
    for(let i = 0; i<=id; i++){
        localStorage.removeItem("osc_macros_"+id);
    }
    localStorage.removeItem("oscmLastID");
    statsus();
}
function editMacros(){
    editing = !editing;
    if(editing){
        API.broadcastMessage({
            app:"OSC Macros",
            event:"editmacros"
        });
    }else{
        API.broadcastMessage({
            app:"OSC Macros",
            event:"doneediting"
        });
    }
    document.getElementById("edit").innerHTML = editing?"Finish Editing Macros":"Edit Macros";
}