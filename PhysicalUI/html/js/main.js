const API = new OVRT({
    "function_queue": true
});
function spawn() {
    API.spawnOverlay({
        posX: 100, 
        posY: 100, 
        posZ: 100, 
        rotX: 0, 
        rotY: 0, 
        rotZ: 0, 
        size: 0.1, 
        opacity: 0, 
        curvature: 0, 
        framerate: 5, 
        ecoMode: true, 
        lookHiding: false, 
        attachedDevice: 0, 
        shouldSave: true
    }).then(overlay => {
        overlay.setBrowserOptionsEnabled(false);
        overlay.setContent(0, {
            url: "manager.html",
            width: 1,
            height: 1
        });
    }).catch(err => {
        console.error(err);
    });
}