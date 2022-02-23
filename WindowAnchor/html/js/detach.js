const API = new OVRT();
window.addEventListener("api-ready", () => {
    API.setCurrentBrowserTitle("Detached Indicator");
    API.blockMovement(true);
    const duration = 300;//ms
    const frameTime = 10;//ms
    API.getUniqueID().then(id => {
        new OVRTOverlay(id).setInputBlocked(true);
        for(let i = 0; i<duration/frameTime; i++){
            setTimeout(() => {
                document.body.style.background = "rgba(255, 71, 63, "+(1-(i/(duration/frameTime)))+")";
            }, i*frameTime);
        }
        setTimeout(() => {
            API.closeOverlay(id);
        }, duration);
    });
});