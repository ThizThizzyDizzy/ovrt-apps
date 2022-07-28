const API = new OVRT({
    "function_queue": true
});
function spawnLeft() {
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
        ecoMode: false, 
        lookHiding: false, 
        attachedDevice: 0, 
        shouldSave: true
    }).then(overlay => {
        currentWindow = overlay;
        overlay.setBrowserOptionsEnabled(false);
        overlay.setContent(0, {
            url: "indicator.html?hand=left",
            width: 500,
            height: 500
        });
        overlay.setPinned(true);
    }).catch(err => {
        console.error(err);
    });
}
function spawnRight() {
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
        ecoMode: false, 
        lookHiding: false, 
        attachedDevice: 0, 
        shouldSave: true
    }).then(overlay => {
        currentWindow = overlay;
        overlay.setBrowserOptionsEnabled(false);
        overlay.setContent(0, {
            url: "indicator.html?hand=right",
            width: 500,
            height: 500
        });
        overlay.setPinned(true);
    }).catch(err => {
        console.error(err);
    });
}
function lock(){
    API.broadcastMessage({
        app:"VRCGestureIndicator",
        event:"lock"
    });
}
function unlock(){
    API.broadcastMessage({
        app:"VRCGestureIndicator",
        event:"unlock"
    });
}
function attach(){
    API.broadcastMessage({
        app:"VRCGestureIndicator",
        event:"attach"
    });
}
function detach(){
    API.broadcastMessage({
        app:"VRCGestureIndicator",
        event:"detach"
    });
}