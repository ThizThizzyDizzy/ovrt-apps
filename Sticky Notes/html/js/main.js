const API = new OVRT({
    "function_queue": true
});
var currentWindow = null;
statsus();
var depth = 0;
function statsus(){
    let total = localStorage.getItem("lastID");
    depth = 0;
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
function spawn(col) {
    API.spawnOverlay({
        posX: 0, 
        posY: 0, 
        posZ: 0, 
        rotX: 0, 
        rotY: 0, 
        rotZ: 0, 
        size: 0.2, 
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
        var id = localStorage.getItem("snLastID");
        if(!id)id = -1;
        id++;
        localStorage.setItem("snLastID", id);
        var key = "sticky_note_"+id;
        if(localStorage.getItem(key))localStorage.removeItem(key);//clear previous settings just in case of duplicates
        overlay.setContent(0, {
            url: "note.html?id="+id+"&col="+col,
            width: 500,
            height: 500
        });
        statsus();
    }).catch(err => {
        console.error(err);
    });
}
function clearData(){
    var id = localStorage.getItem("snLastID");
    if(!id)return;
    for(let i = 0; i<=id; i++){
        localStorage.removeItem("sticky_note_"+id);
    }
    localStorage.removeItem("snLastID");
    statsus();
}